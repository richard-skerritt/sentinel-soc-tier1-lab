import { useEffect, useState } from "react";
import { Book, BookOpen, Check, Copy, CheckCheck, Lightbulb } from "lucide-react";
import runbooksData from "@/data/runbooks.json";
import type { Runbook, RunbookCategory, RunbookMap } from "@/lib/types";

const runbooks = runbooksData as unknown as RunbookMap;

interface RunbookPanelProps {
  alertId: string;
  alertCategory: RunbookCategory;
  mitreId: string;
  // Hint integration: runbook is where guidance lives.
  hintCount?: number;
  hintShown?: number;
  hunterHints?: string[];
  onAskHint?: () => void;
  // Guided-mode integration: open the StepGuideDialog for a given step.
  onGuideStep?: (category: RunbookCategory, stepId: number) => void;
  guidedMode?: boolean;
}

const CATEGORY_PILL: Record<RunbookCategory, string> = {
  authentication: "bg-blue-500/15 border-blue-500/40 text-blue-300",
  malware: "bg-red-500/15 border-red-500/40 text-red-300",
  phishing: "bg-orange-500/15 border-orange-500/40 text-orange-300",
  network: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300",
  "lateral-movement": "bg-yellow-500/15 border-yellow-500/40 text-yellow-300",
  "privilege-escalation": "bg-purple-500/15 border-purple-500/40 text-purple-300",
};

const TOOL_BADGE: Record<string, string> = {
  Sentinel: "bg-[#0078d4]/15 border-[#0078d4]/40 text-[#4faaff]",
  Rapid7: "bg-[#e5402a]/15 border-[#e5402a]/40 text-[#ff7d63]",
  Kibana: "bg-[#0077cc]/15 border-[#0077cc]/40 text-[#5ab2ff]",
  ELK: "bg-[#0077cc]/15 border-[#0077cc]/40 text-[#5ab2ff]",
  EDR: "bg-purple-500/15 border-purple-500/40 text-purple-300",
  ServiceNow: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  Firewall: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  "Entra ID": "bg-blue-400/15 border-blue-400/40 text-blue-300",
  "Defender for O365": "bg-cyan-500/15 border-cyan-500/40 text-cyan-300",
};

const toolClass = (tool: string): string =>
  TOOL_BADGE[tool] ?? "bg-muted/40 border-border text-foreground/80";

const progressKey = (alertId: string) => `runbook_progress_${alertId}`;

export function RunbookPanel({
  alertId,
  alertCategory,
  mitreId,
  hintCount,
  hintShown,
  hunterHints,
  onAskHint,
  onGuideStep,
  guidedMode,
}: RunbookPanelProps) {
  const runbook: Runbook | undefined = runbooks[alertCategory];

  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressKey(alertId));
      setCompleted(new Set<number>(raw ? JSON.parse(raw) : []));
    } catch {
      setCompleted(new Set());
    }
  }, [alertId]);

  const toggleStep = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(progressKey(alertId), JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const copyKql = async (stepId: number, kql: string) => {
    try {
      await navigator.clipboard.writeText(kql);
      setCopiedId(stepId);
      setTimeout(() => setCopiedId((c) => (c === stepId ? null : c)), 1200);
    } catch {}
  };

  if (!runbook) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground p-6 text-center bg-card/30">
        No runbook is defined for category <code className="mono text-primary">{alertCategory}</code>.
        <br />
        Add one to <code className="mono">runbooks.json</code>.
      </div>
    );
  }

  const total = runbook.steps.length;
  const completedCount = runbook.steps.filter((s) => completed.has(s.id)).length;
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const currentStepIdx = Math.min(completedCount + 1, total);

  const showHint = hintShown !== undefined && hintShown >= 0 && hunterHints && hunterHints[hintShown];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/30">
      <div className="border-b border-border px-4 pt-3 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Runbook
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] mono uppercase tracking-wider rounded border px-1.5 py-0.5 ${CATEGORY_PILL[alertCategory] ?? "bg-muted/40 border-border text-foreground/80"}`}
              data-testid="runbook-category-pill"
            >
              {alertCategory}
            </span>
            <span className="text-[10px] mono uppercase tracking-wider rounded border border-border bg-muted/40 text-foreground/80 px-1.5 py-0.5">
              {mitreId}
            </span>
          </div>
        </div>
        <h2 className="text-base font-semibold leading-tight" data-testid="runbook-title">
          {runbook.title}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-2 space-y-2">
          <div>
            <div className="flex justify-between items-center text-[11px] mb-1.5">
              <span className="text-muted-foreground">
                Step {currentStepIdx} of {total}
              </span>
              <span className="mono text-foreground/80" data-testid="runbook-progress">
                {completedCount} / {total}
              </span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {onAskHint && (
            <div className="space-y-1.5">
              <button
                onClick={onAskHint}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors text-xs"
                data-testid="btn-hint-runbook"
                title="Ask Morgan for a hint"
              >
                <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                <span>Ask Morgan for a hint</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {hintCount ?? 0} used
                </span>
              </button>
              {showHint && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2.5 text-xs text-yellow-100/90 leading-relaxed">
                  {hunterHints![hintShown!]}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 space-y-5">
          {runbook.steps.map((step) => {
            const isDone = completed.has(step.id);
            return (
              <div
                key={step.id}
                className={`border rounded-md p-3 space-y-2.5 ${isDone ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
                data-testid={`runbook-step-${step.id}`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => toggleStep(step.id)}
                    className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-sm mono font-medium ${
                      isDone
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                    title={isDone ? "Mark step incomplete" : "Mark step complete"}
                    data-testid={`runbook-step-${step.id}-toggle`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : step.id}
                  </button>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{step.action}</p>
                      <span
                        className={`shrink-0 text-[9px] mono uppercase tracking-wider rounded border px-1.5 py-0.5 ${toolClass(step.tool)}`}
                      >
                        {step.tool}
                      </span>
                    </div>
                    {step.kql && (
                      <div className="relative group">
                        <pre
                          className="mono text-[12px] border border-border rounded p-2.5 overflow-x-auto whitespace-pre leading-relaxed min-h-[4.5rem] text-slate-100"
                          style={{ backgroundColor: "#0b1220" }}
                        >
                          {step.kql}
                        </pre>
                        <button
                          onClick={() => copyKql(step.id, step.kql)}
                          className="absolute top-1.5 right-1.5 bg-muted/80 hover:bg-muted border border-border rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1"
                          data-testid={`runbook-step-${step.id}-copy`}
                        >
                          {copiedId === step.id ? (
                            <>
                              <CheckCheck className="h-3 w-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground/80 font-semibold">Expected: </span>
                      {step.expectedResult}
                    </p>
                    <div className="space-y-1.5">
                      <div className="text-sm leading-relaxed rounded border-l-4 border-l-green-500 border-y border-r border-green-900/40 bg-green-900/10 text-green-200/90 p-3">
                        <span className="font-semibold">Yes → </span>
                        {step.decisionYes}
                      </div>
                      <div className="text-sm leading-relaxed rounded border-l-4 border-l-amber-500 border-y border-r border-amber-900/40 bg-amber-900/10 text-amber-200/90 p-3">
                        <span className="font-semibold">No → </span>
                        {step.decisionNo}
                      </div>
                    </div>
                    {onGuideStep && (
                      <button
                        onClick={() => onGuideStep(alertCategory, step.id)}
                        className={`text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5 ${
                          guidedMode ? "animate-pulse" : ""
                        }`}
                        data-testid={`runbook-step-${step.id}-guide`}
                      >
                        <BookOpen className="h-3 w-3" /> Guide me through this step
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
