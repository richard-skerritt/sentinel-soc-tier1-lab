import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Volume2,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { testVoice, invalidateVoiceConfig } from "@/lib/voice";
import {
  listStacks,
  getActiveStackId,
  setActiveStackId,
  isStackFullySupported,
} from "@/lib/toolStack";

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

  const stacks = listStacks();
  const [activeStack, setStack] = useState<string>(() => getActiveStackId());
  const handleStackChange = (id: string) => {
    setStack(id);
    setActiveStackId(id);
  };
  const stackSupported = isStackFullySupported(activeStack);

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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4" /> Tool stack
            </h2>
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${
                stackSupported
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}
            >
              {stackSupported ? "Active" : "Preview only"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Switches the labels and tool panels used throughout the lab. Only the Nightshift
            default stack has fully-wired tool panels; the others show a Coming-soon overlay.
          </p>
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Active stack
            </div>
            <select
              value={activeStack}
              onChange={(e) => handleStackChange(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
              data-testid="tool-stack-select"
            >
              {stacks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {(() => {
            const current = stacks.find((s) => s.id === activeStack) ?? stacks[0];
            return (
              <dl className="grid grid-cols-2 gap-y-1 text-[11px] mono pt-2 border-t border-border">
                <dt className="text-muted-foreground">SIEM</dt>
                <dd>{current.siem} ({current.siemQueryLanguage})</dd>
                <dt className="text-muted-foreground">XDR</dt>
                <dd>{current.xdr}</dd>
                <dt className="text-muted-foreground">Log platform</dt>
                <dd>{current.logPlatform}</dd>
                <dt className="text-muted-foreground">EDR</dt>
                <dd>{current.edr}</dd>
                <dt className="text-muted-foreground">IDPS</dt>
                <dd>{current.idps}</dd>
                <dt className="text-muted-foreground">Ticketing</dt>
                <dd>{current.ticketing}</dd>
              </dl>
            );
          })()}
        </section>

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
