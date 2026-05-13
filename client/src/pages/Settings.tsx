import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Volume2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { testVoice, invalidateVoiceConfig } from "@/lib/voice";

export default function Settings() {
  const { data: settings = {} } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const [elevenKey, setElevenKey] = useState("");
  const [elevenVoice, setElevenVoice] = useState("");
  const [analystName, setAnalystName] = useState("");
  const [testState, setTestState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    setElevenKey(settings.elevenLabsKey ?? "");
    setElevenVoice(settings.elevenLabsVoiceId ?? "");
    setAnalystName(settings.analystName ?? "");
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (s: Record<string, string>) => apiRequest("POST", "/api/settings", s),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      invalidateVoiceConfig();
    },
  });

  const save = () => {
    saveMut.mutate({
      elevenLabsKey: elevenKey,
      elevenLabsVoiceId: elevenVoice,
      analystName,
    });
  };

  const runTest = async () => {
    // Save first so the server has the latest creds, then test.
    setTestState("running");
    setTestError(null);
    try {
      await apiRequest("POST", "/api/settings", {
        elevenLabsKey: elevenKey,
        elevenLabsVoiceId: elevenVoice,
        analystName,
      });
      invalidateVoiceConfig();
      const r = await testVoice();
      if (r.ok) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestError(r.error || "Unknown error");
      }
    } catch (e: any) {
      setTestState("error");
      setTestError(String(e?.message || e));
    }
  };

  const configured = !!(elevenKey && elevenVoice);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
            <SettingsIcon className="h-3 w-3" /> Settings
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Lab configuration</h1>
        </header>

        <section className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Analyst profile</h2>
          <Field
            label="Display name"
            value={analystName}
            onChange={setAnalystName}
            placeholder="What should Morgan call you?"
          />
        </section>

        <section className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="h-4 w-4" /> Morgan's voice (ElevenLabs)
            </h2>
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${
                configured ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {configured ? "Configured" : "Not configured"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your ElevenLabs API key and a Voice ID. Morgan's dialogue lines will play as audio. Get a voice ID from{" "}
            <a className="text-primary underline" href="https://elevenlabs.io/app/voice-lab" target="_blank" rel="noreferrer">
              elevenlabs.io/app/voice-lab
            </a>
            . Without these, the lab runs text-only.
          </p>
          <Field label="API key" value={elevenKey} onChange={setElevenKey} type="password" placeholder="sk_…" />
          <Field label="Voice ID" value={elevenVoice} onChange={setElevenVoice} placeholder="21m00Tcm4TlvDq8ikWAM" />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} data-testid="btn-save-settings">
              Save settings
            </Button>
            <Button
              variant="outline"
              onClick={runTest}
              disabled={!elevenKey || !elevenVoice || testState === "running"}
              data-testid="btn-test-voice"
            >
              {testState === "running" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Testing…
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 mr-1.5" />
                  Test voice
                </>
              )}
            </Button>
            {testState === "ok" && (
              <span className="text-xs flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Played
              </span>
            )}
            {testState === "error" && (
              <span className="text-xs flex items-center gap-1 text-red-400" title={testError ?? ""}>
                <XCircle className="h-3.5 w-3.5" /> Failed
              </span>
            )}
          </div>
          {testState === "error" && testError && (
            <div className="text-xs text-red-300/90 bg-red-500/10 border border-red-500/30 rounded p-2 font-mono break-all">
              {testError}
            </div>
          )}
          <ul className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border">
            <li>• If the test plays silence: check your browser tab isn't muted and your system volume is up.</li>
            <li>• If you get "voice_not_configured": save settings before testing.</li>
            <li>• If you get "upstream_error 401": API key is invalid.</li>
            <li>• If you get "upstream_error 422": voice ID isn't valid for that key.</li>
          </ul>
        </section>

        <Button onClick={save} data-testid="btn-save-settings-bottom">
          Save settings
        </Button>
      </div>
    </Layout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
      />
    </label>
  );
}
