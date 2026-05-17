import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Eye,
  ClipboardList,
  FileText,
  Terminal,
} from "lucide-react";
import runbooksData from "@/data/runbooks.json";
import {
  getGuideStep,
  getAvailableStepIds,
  validatePractice,
  type GuideStep,
} from "@/lib/tutorialEngine";
import type { RunbookCategory, RunbookMap } from "@/lib/types";

const runbooks = runbooksData as unknown as RunbookMap;

interface StepGuideDialogProps {
  open: boolean;
  category: RunbookCategory | null;
  stepId: number | null;
  onClose: () => void;
  onNavigate: (newStepId: number) => void;
  /** For KQL steps — loads the answer into the Sentinel editor + switches to it. */
  onLoadQuery?: (query: string) => void;
  /** Switch the active tool tab. Called when dialog opens or on "Switch to" link click. */
  onSwitchTool?: (tool: GuideStep["tool"]) => void;
}

const TOOL_LABEL: Record<GuideStep["tool"], string> = {
  sentinel: "Sentinel",
  rapid7: "Rapid7 InsightIDR",
  elk: "Kibana / ELK",
  edr: "Defender for Endpoint",
};

const TOOL_COLOUR: Record<GuideStep["tool"], string> = {
  sentinel: "#0078d4",
  rapid7: "#e5402a",
  elk: "#0077cc",
  edr: "#5c2d91",
};

export function StepGuideDialog({
  open,
  category,
  stepId,
  onClose,
  onNavigate,
  onLoadQuery,
  onSwitchTool,
}: StepGuideDialogProps) {
  const step: GuideStep | null = useMemo(() => {
    if (!category || stepId == null) return null;
    return getGuideStep(category, stepId);
  }, [category, stepId]);

  const stepIds = useMemo(() => (category ? getAvailableStepIds(category) : []), [category]);
  const idx = stepId != null ? stepIds.indexOf(stepId) : -1;
  const prevId = idx > 0 ? stepIds[idx - 1] : null;
  const nextId = idx >= 0 && idx < stepIds.length - 1 ? stepIds[idx + 1] : null;

  // Practice state — reset whenever the dialog re-targets a step.
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<
    | null
    | { kind: "ok"; msg: string }
    | { kind: "fail"; hint: string; missing: string[] }
  >(null);

  useEffect(() => {
    setInput("");
    setFeedback(null);
  }, [category, stepId]);

  // The runbook KQL — used by "Show me the answer" and "Load into editor".
  const runbookStep = useMemo(() => {
    if (!category || stepId == null) return null;
    const rb = runbooks[category];
    return rb?.steps.find((s) => s.id === stepId) ?? null;
  }, [category, stepId]);

  if (!step || !category || stepId == null) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No guide content</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This step doesn't have a guide entry yet — add one to <code className="mono">guideSteps.json</code>.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const handleCheck = () => {
    const result = validatePractice(input, step.practice_keywords);
    if (result.ok) {
      setFeedback({ kind: "ok", msg: step.practice_success });
    } else {
      setFeedback({ kind: "fail", hint: step.practice_hint, missing: result.missing });
    }
  };

  const handleShowAnswer = () => {
    if (runbookStep?.kql) {
      setInput(runbookStep.kql);
    } else {
      // Fallback for non-KQL steps — fill with the placeholder which often has the shape.
      setInput(step.practice_placeholder);
    }
  };

  const handleLoadIntoEditor = () => {
    if (!onLoadQuery) return;
    const text = input.trim() || runbookStep?.kql || "";
    if (!text) return;
    onLoadQuery(text);
    onClose();
  };

  const toolLabel = TOOL_LABEL[step.tool];
  const toolColour = TOOL_COLOUR[step.tool];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin p-0 gap-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${category}-${stepId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-border space-y-2">
              <DialogTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Step {stepId} — {capitalise(category)} runbook
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                Switch to:
                <button
                  onClick={() => onSwitchTool?.(step.tool)}
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] mono uppercase tracking-wider hover:opacity-80"
                  style={{
                    color: toolColour,
                    borderColor: `${toolColour}66`,
                    backgroundColor: `${toolColour}15`,
                  }}
                  data-testid="guide-switch-tool"
                >
                  {toolLabel} <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </DialogHeader>

            {/* What we're doing / why / what to look for */}
            <div className="px-5 py-4 space-y-4">
              <GuideSection icon={<Eye className="h-3.5 w-3.5 text-primary" />} title="What we're doing">
                <p className="text-sm leading-relaxed whitespace-pre-line">{step.plain_english}</p>
              </GuideSection>

              <div className="rounded border-l-4 border-l-amber-500 border-y border-r border-amber-900/40 bg-amber-900/10 p-3">
                <SectionTitle>Why this matters</SectionTitle>
                <p className="text-sm leading-relaxed text-amber-100/90 whitespace-pre-line">
                  {step.why}
                </p>
              </div>

              <div className="rounded border-l-4 border-l-green-500 border-y border-r border-green-900/40 bg-green-900/10 p-3">
                <SectionTitle>What to look for in the results</SectionTitle>
                <p className="text-sm leading-relaxed text-green-100/90 whitespace-pre-line">
                  {step.what_to_look_for}
                </p>
              </div>
            </div>

            {/* Practice */}
            <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                {step.terminal_mode ? (
                  <Terminal className="h-4 w-4 text-green-400" />
                ) : (
                  <ClipboardList className="h-4 w-4 text-primary" />
                )}
                <h3 className="text-sm font-semibold">Practice</h3>
              </div>
              <p className="text-sm font-medium">{step.practice_prompt}</p>

              {step.terminal_mode ? (
                <div
                  className="rounded border border-green-900/50 p-3 font-mono text-sm"
                  style={{ backgroundColor: "#000000" }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-green-700 mb-1">
                    {step.terminal_context ?? "Terminal"}
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={step.practice_placeholder}
                    rows={4}
                    className="w-full bg-transparent text-green-400 outline-none resize-y placeholder:text-green-900"
                    data-testid="guide-practice-input"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={step.practice_placeholder}
                  rows={4}
                  className="w-full rounded border border-border p-2 font-mono text-sm text-slate-100 outline-none resize-y placeholder:text-slate-500"
                  style={{ backgroundColor: "#0b1220" }}
                  data-testid="guide-practice-input"
                  spellCheck={false}
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleCheck} data-testid="guide-check">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Check answer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowAnswer}
                  data-testid="guide-show"
                >
                  <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Show me the answer
                </Button>
                {step.tool === "sentinel" && onLoadQuery && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLoadIntoEditor}
                    data-testid="guide-load"
                    className="ml-auto gap-1.5"
                  >
                    Load into editor <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {feedback && feedback.kind === "ok" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded border border-green-700/40 bg-green-900/20 text-green-200/90 px-3 py-2 text-sm"
                  data-testid="guide-feedback-ok"
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-400" />
                  <span>{feedback.msg}</span>
                </motion.div>
              )}
              {feedback && feedback.kind === "fail" && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded border border-amber-700/40 bg-amber-900/20 text-amber-100/90 px-3 py-2 text-sm space-y-2"
                  data-testid="guide-feedback-fail"
                >
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
                    <span>{feedback.hint}</span>
                  </div>
                  {feedback.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-6">
                      <span className="text-[10px] uppercase tracking-widest text-amber-200/70 mr-1">
                        Missing:
                      </span>
                      {feedback.missing.map((k) => (
                        <span
                          key={k}
                          className="text-[10px] mono rounded border border-red-500/40 bg-red-900/30 text-red-200 px-1.5 py-0.5"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* How this connects */}
            <div className="border-t border-border px-5 py-4 space-y-2 bg-card/40">
              <div className="flex items-start gap-2 text-sm">
                <ClipboardList className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <p>
                  <span className="font-semibold text-foreground/90">Runbook: </span>
                  <span className="text-muted-foreground">{step.runbook_connection}</span>
                </p>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <p>
                  <span className="font-semibold text-foreground/90">Report: </span>
                  <span className="text-muted-foreground">{step.report_connection}</span>
                </p>
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted/20">
              <Button
                size="sm"
                variant="outline"
                disabled={prevId == null}
                onClick={() => prevId != null && onNavigate(prevId)}
                data-testid="guide-prev"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Previous step
              </Button>
              <span className="text-[11px] mono text-muted-foreground">
                {idx + 1} / {stepIds.length}
              </span>
              <Button
                size="sm"
                disabled={nextId == null}
                onClick={() => nextId != null && onNavigate(nextId)}
                data-testid="guide-next"
              >
                Next step <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function GuideSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <SectionTitle>{title}</SectionTitle>
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
      {children}
    </h4>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}
