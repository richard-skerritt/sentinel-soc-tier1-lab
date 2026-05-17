import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { KqlEditor } from "@/components/KqlEditor";
import mentor from "@/data/mentor.json";
import { Link } from "wouter";
import { runQuery } from "@/lib/kqlClient";
import {
  ArrowLeft,
  ArrowRight,
  Inbox,
  Code2,
  Search,
  Shield,
  Play,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { JargonText, JargonTip } from "@/components/JargonTip";

const STORAGE_KEY = "nightshift_completed_orientation";

interface OrientationFlowProps {
  /** Called when the user finishes or skips orientation. */
  onComplete: () => void;
}

export function OrientationFlow({ onComplete }: OrientationFlowProps) {
  const [step, setStep] = useState(1);
  const total = 5;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    onComplete();
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="text-[11px] uppercase tracking-widest text-primary flex items-center gap-1.5">
          <GraduationCap className="h-3 w-3" /> Start here
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="mono">Step {step} of {total}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  i + 1 <= step ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-[11px] hover:underline text-muted-foreground hover:text-foreground ml-3"
            data-testid="orientation-skip"
          >
            Skip orientation
          </button>
        </div>
      </div>

      <div className="px-6 py-5 min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {step === 1 && <StepWhatIsSoc />}
            {step === 2 && <StepTools />}
            {step === 3 && <StepKql />}
            {step === 4 && <StepShiftLoop />}
            {step === 5 && <StepReady onFinish={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/20">
        <Button
          size="sm"
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          data-testid="orientation-back"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
        {step < total ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => Math.min(total, s + 1))}
            data-testid="orientation-next"
          >
            Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        ) : (
          <Link href="/queue">
            <Button size="sm" onClick={finish} data-testid="orientation-finish" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" /> Open the alert queue
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function StepWhatIsSoc() {
  return (
    <>
      <h2 className="text-base font-semibold">What is a SOC?</h2>
      <div className="text-sm leading-relaxed space-y-3 text-foreground/90">
        <p>
          You are training to be a <JargonTip slug="SOC" term="SOC Analyst" /> —{" "}
          <JargonTip slug="Tier 1" term="Tier 1" />.
        </p>
        <p>
          The <JargonTip slug="SOC" term="SOC" /> (Security Operations Centre) is the team that
          watches a company's IT systems around the clock for signs of attack.
        </p>
        <p>
          When something suspicious happens — a login from an unusual country, a program
          behaving strangely, unusual network traffic — the{" "}
          <JargonTip slug="SIEM" term="SIEM" /> (Security Information and Event Management
          system) fires an alert.
        </p>
        <p>
          That alert lands in the queue. You open it. You investigate. You decide if it's real.
        </p>
        <p className="font-medium text-foreground">That's the job.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground mono">
        <Pill>Event happens</Pill>
        <Arrow />
        <Pill>SIEM detects</Pill>
        <Arrow />
        <Pill>Alert fires</Pill>
        <Arrow />
        <Pill>You investigate</Pill>
        <Arrow />
        <Pill accent>You decide</Pill>
      </div>
    </>
  );
}

function StepTools() {
  return (
    <>
      <h2 className="text-base font-semibold">What are the tools?</h2>
      <p className="text-sm leading-relaxed">
        You have four tools open on every alert:
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ToolBox
          name="Sentinel"
          slug="Sentinel"
          subtitle="Microsoft's SIEM."
          body="You write KQL queries to search logs."
          tone="#0078d4"
        />
        <ToolBox
          name="Rapid7"
          slug="Rapid7"
          subtitle="A second SIEM."
          body="Different query language (LEQL), same idea."
          tone="#e5402a"
        />
        <ToolBox
          name="ELK"
          slug="ELK"
          subtitle="A third log platform."
          body="You'll see the same attack look different here."
          tone="#0077cc"
        />
        <ToolBox
          name="EDR"
          slug="EDR"
          subtitle="The security agent on the device."
          body="Shows what ran on the affected machine."
          tone="#5c2d91"
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
        Using multiple tools teaches you that real SOCs aren't one-tool shops.
      </p>
    </>
  );
}

function StepKql() {
  const initial = `SigninLogs
| where IPAddress == "45.83.193.150"
| take 10`;
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const r = await runQuery(query);
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold">
        What is <JargonTip slug="KQL" term="KQL" />? (Don't panic)
      </h2>
      <p className="text-sm leading-relaxed">
        <JargonTip slug="KQL" term="KQL" /> is the language you use in Microsoft Sentinel to ask
        questions about logs. It looks scary. It isn't. Here is the entire logic:
      </p>
      <pre
        className="mono text-xs rounded p-3 border border-border"
        style={{ backgroundColor: "#0b1220", color: "#cfd6e4" }}
      >
{`Table name
| filter to rows you care about
| calculate or reshape
| sort or limit`}
      </pre>
      <p className="text-sm leading-relaxed">
        That's it. Every KQL query you'll ever write follows that shape.
      </p>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Try it</p>
        <div className="rounded border border-border overflow-hidden">
          <KqlEditor value={query} onChange={setQuery} onRun={run} minHeight="92px" />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} disabled={running} data-testid="orientation-run-kql">
            <Play className="h-3.5 w-3.5 mr-1.5" /> {running ? "Running…" : "Run it"}
          </Button>
          {result && !result.error && (
            <span className="text-xs text-green-300">
              ✓ {result.totalRows} rows came back. Read the columns — that's a real query against
              real data.
            </span>
          )}
          {result?.error && (
            <span className="text-xs text-red-300 mono">{result.error}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pt-2">
        Read the query out loud: "Look in the sign-in logs. Keep only the rows where the IP
        address is that one. Show me the first ten."
      </p>
    </>
  );
}

function StepShiftLoop() {
  const items = [
    "Read the alert — what fired, how serious, what entity (IP / user / device)",
    "Check the investigation goals — four questions you need to answer",
    "Run the starter query in Sentinel — see the raw data",
    "Follow the runbook (right panel) — step-by-step guide for this alert type",
    "Cross-check in Rapid7 and ELK — confirm your findings",
    "Submit your verdict — True Positive, False Positive, or Benign Positive",
    "Export the report — a Tier 2 handoff document",
  ];
  return (
    <>
      <h2 className="text-base font-semibold">What do you actually do on a shift?</h2>
      <p className="text-sm leading-relaxed">Every alert follows the same loop:</p>
      <ol className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 border border-primary/40 text-primary text-[10px] mono font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <JargonText text={t} />
          </li>
        ))}
      </ol>
    </>
  );
}

function StepReady({ onFinish: _onFinish }: { onFinish: () => void }) {
  const morganLine =
    mentor.scripts.welcome_first_login?.[0] ??
    "First shift's always nervy. Read carefully, don't guess, ask if you're stuck.";
  return (
    <>
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> You're ready. One tip from Morgan.
      </h2>
      <div className="rounded border-l-4 border-l-primary bg-primary/5 p-4 text-sm leading-relaxed">
        "{morganLine}"
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
          — Morgan Reyes, Tier 3 shift lead
        </div>
      </div>
      <p className="text-sm leading-relaxed">
        Click the button below to open the alert queue. The first alert is loaded with help —
        you'll be guided through the investigation.
      </p>
    </>
  );
}

function Pill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded border text-[11px] ${
        accent
          ? "bg-primary/15 border-primary/50 text-primary"
          : "bg-muted/40 border-border text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return <ArrowRight className="h-3 w-3 text-muted-foreground/60" />;
}

function ToolBox({
  name,
  slug,
  subtitle,
  body,
  tone,
}: {
  name: string;
  slug: string;
  subtitle: string;
  body: string;
  tone: string;
}) {
  return (
    <div
      className="rounded border bg-card p-3"
      style={{ borderColor: `${tone}55`, borderLeftWidth: 4, borderLeftColor: tone }}
    >
      <div className="text-sm font-semibold flex items-center gap-1.5">
        {name === "Sentinel" && <Code2 className="h-3.5 w-3.5" style={{ color: tone }} />}
        {name === "Rapid7" && <Search className="h-3.5 w-3.5" style={{ color: tone }} />}
        {name === "ELK" && <Code2 className="h-3.5 w-3.5" style={{ color: tone }} />}
        {name === "EDR" && <Shield className="h-3.5 w-3.5" style={{ color: tone }} />}
        <JargonTip slug={slug} term={name} />
      </div>
      <div className="text-[11px] mono text-muted-foreground mt-0.5">{subtitle}</div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}
