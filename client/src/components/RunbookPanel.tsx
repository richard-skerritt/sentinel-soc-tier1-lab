import { useEffect, useMemo, useState } from "react";
import {
  Book,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCheck,
  Wrench,
} from "lucide-react";
import runbooksData from "@/data/runbooks.json";
import type { Runbook, RunbookCategory, RunbookMap } from "@/lib/types";
import { Button } from "@/components/ui/button";

const runbooks = runbooksData as unknown as RunbookMap;

interface RunbookPanelProps {
  alertId: string;
  alertCategory: RunbookCategory;
  mitreId: string;
  isOpen: boolean;
  onToggle: () => void;
}

function progressKey(alertId: string) {
  return `runbook_progress_${alertId}`;
}

export function RunbookPanel({
  alertId,
  alertCategory,
  mitreId,
  isOpen,
  onToggle,
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

  const completedCount = useMemo(
    () => (runbook ? runbook.steps.filter((s) => completed.has(s.id)).length : 0),
    [runbook, completed],
  );

  // Always show a thin toggle on the right edge — even when content area is missing
  if (!runbook) {
    return (
      <RunbookEdgeToggle isOpen={isOpen} onToggle={onToggle} disabled>
        <div className="p-4 text-xs text-muted-foreground">
          No runbook is defined for category <code className="mono">{alertCategory}</code>. Update{" "}
          <code className="mono">runbooks.json</code> to add one.
        </div>
      </RunbookEdgeToggle>
    );
  }

  const total = runbook.steps.length;
  const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <RunbookEdgeToggle isOpen={isOpen} onToggle={onToggle}>
      <div className="flex flex-col h-full">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Book className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Runbook</span>
            </div>
            <span className="text-[10px] mono text-muted-foreground">
              {mitreId} · {alertCategory}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold leading-tight" data-testid="runbook-title">
              {runbook.title}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Wrench className="h-3 w-3" />
              <span>{runbook.tool}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Progress</span>
              <span data-testid="runbook-progress">
                {completedCount} / {total}
              </span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
          {runbook.steps.map((step) => {
            const isDone = completed.has(step.id);
            return (
              <div
                key={step.id}
                className={`border rounded-md p-3 space-y-2 ${
                  isDone ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                }`}
                data-testid={`runbook-step-${step.id}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleStep(step.id)}
                    className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] mono ${
                      isDone
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                    title={isDone ? "Mark step incomplete" : "Mark step complete"}
                    data-testid={`runbook-step-${step.id}-toggle`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : step.id}
                  </button>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug">{step.action}</p>
                      <span className="shrink-0 text-[9px] mono uppercase tracking-wider bg-muted/40 border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                        {step.tool}
                      </span>
                    </div>
                    {step.kql && (
                      <div className="relative">
                        <pre className="mono text-[10px] bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre">
                          {step.kql}
                        </pre>
                        <button
                          onClick={() => copyKql(step.id, step.kql)}
                          className="absolute top-1 right-1 bg-muted/60 hover:bg-muted border border-border rounded px-1.5 py-0.5 text-[9px] flex items-center gap-1"
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
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      <span className="text-foreground/80 font-medium">Expected: </span>
                      {step.expectedResult}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      <div className="text-[11px] leading-snug rounded border border-green-700/30 bg-green-900/10 text-green-300/90 px-2 py-1">
                        <span className="font-semibold">Yes → </span>
                        {step.decisionYes}
                      </div>
                      <div className="text-[11px] leading-snug rounded border border-amber-700/30 bg-amber-900/10 text-amber-200/90 px-2 py-1">
                        <span className="font-semibold">No → </span>
                        {step.decisionNo}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </RunbookEdgeToggle>
  );
}

function RunbookEdgeToggle({
  isOpen,
  onToggle,
  disabled = false,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggle}
        disabled={disabled}
        className="h-full rounded-none border-l border-border border-y-0 px-1.5 flex flex-col items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
        data-testid="runbook-toggle"
        title={isOpen ? "Hide runbook" : "Show runbook"}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        <Book className="h-4 w-4" />
        <span className="vertical-rl">{isOpen ? "Hide" : "Runbook"}</span>
      </Button>
      <div
        className={`transition-all duration-200 overflow-hidden border-l border-border bg-card/30 ${
          isOpen ? "w-[380px] min-w-[320px]" : "w-0"
        }`}
      >
        {isOpen ? children : null}
      </div>
    </div>
  );
}
