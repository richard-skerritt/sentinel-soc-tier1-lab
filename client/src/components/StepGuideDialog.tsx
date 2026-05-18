// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
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
import { JargonText } from "@/components/JargonTip";

const runbooks = runbooksData as unknown as RunbookMap;

interface StepGuideDialogProps {
  open: boolean;
  category: RunbookCategory | null;
  stepId: number | null;
  /** Used to scope per-alert progress (stage etc) in localStorage. */
  alertId?: string | null;
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
  alertId,
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

  // ────────────────────────────────────────────────────────────────
  // Three-stage scaffolded practice (KQL only, not terminal mode).
  // ────────────────────────────────────────────────────────────────
  const stageStorageKey =
    alertId && category && stepId != null
      ? `practice_stage_${alertId}_${category}_${stepId}`
      : null;
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [blankInputs, setBlankInputs] = useState<string[]>([]);
  const [stageFeedback, setStageFeedback] = useState<
    | null
    | { kind: "ok"; msg: string }
    | { kind: "fail"; msg: string; wrongIdx: number[] }
  >(null);

  // Pick blanks from runbook KQL: take practice_keywords in order, keep only the
  // ones that actually appear as whole tokens in the query.
  const blanks = useMemo(() => {
    if (!runbookStep?.kql || !step) return [] as { keyword: string; index: number }[];
    const out: { keyword: string; index: number }[] = [];
    const used = new Set<number>();
    for (const kw of step.practice_keywords) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      const m = re.exec(runbookStep.kql);
      if (m && m.index !== undefined && !used.has(m.index)) {
        out.push({ keyword: kw, index: m.index });
        used.add(m.index);
      }
      if (out.length >= 2) break;
    }
    return out.sort((a, b) => a.index - b.index);
  }, [runbookStep, step]);

  // Number of blanks visible at each stage. Stage 3 uses no blanks (free-form).
  const blanksForStage = (s: 1 | 2 | 3): number => {
    if (s === 3) return 0;
    return Math.min(blanks.length, s === 1 ? 1 : 2);
  };

  // Hydrate stage from localStorage when targeting a new step.
  useEffect(() => {
    setStageFeedback(null);
    setBlankInputs([]);
    if (!stageStorageKey) return;
    try {
      const raw = localStorage.getItem(stageStorageKey);
      const n = raw ? parseInt(raw, 10) : 1;
      setStage((n === 2 || n === 3) ? (n as 1 | 2 | 3) : 1);
    } catch {
      setStage(1);
    }
  }, [stageStorageKey]);

  const advanceStage = (target: 1 | 2 | 3) => {
    setStage(target);
    setStageFeedback(null);
    setBlankInputs([]);
    if (stageStorageKey) {
      try {
        localStorage.setItem(stageStorageKey, String(target));
      } catch {}
    }
  };

  const handleBlankCheck = () => {
    if (!step) return;
    const expected = blanks.slice(0, blanksForStage(stage)).map((b) => b.keyword);
    const wrongIdx: number[] = [];
    expected.forEach((kw, i) => {
      const got = (blankInputs[i] ?? "").trim();
      if (got.toLowerCase() !== kw.toLowerCase()) wrongIdx.push(i);
    });
    if (wrongIdx.length === 0) {
      setStageFeedback({ kind: "ok", msg: step.practice_success });
    } else {
      setStageFeedback({
        kind: "fail",
        msg: step.practice_hint,
        wrongIdx,
      });
    }
  };

  const renderQueryWithBlanks = () => {
    if (!runbookStep?.kql) return null;
    const visible = blanks.slice(0, blanksForStage(stage));
    if (visible.length === 0) return null;
    const segments: { type: "text" | "blank"; value: string; blankIdx?: number }[] = [];
    let cursor = 0;
    visible.forEach((b, i) => {
      segments.push({ type: "text", value: runbookStep.kql.slice(cursor, b.index) });
      segments.push({ type: "blank", value: b.keyword, blankIdx: i });
      cursor = b.index + b.keyword.length;
    });
    segments.push({ type: "text", value: runbookStep.kql.slice(cursor) });
    return segments;
  };

  const querySegments = renderQueryWithBlanks();

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
                <JargonText
                  asBlock
                  text={step.plain_english}
                  className="text-sm leading-relaxed whitespace-pre-line"
                />
              </GuideSection>

              <div className="rounded border-l-4 border-l-amber-500 border-y border-r border-amber-900/40 bg-amber-900/10 p-3">
                <SectionTitle>Why this matters</SectionTitle>
                <JargonText
                  asBlock
                  inverse
                  text={step.why}
                  className="text-sm leading-relaxed text-amber-100/90 whitespace-pre-line"
                />
              </div>

              <div className="rounded border-l-4 border-l-green-500 border-y border-r border-green-900/40 bg-green-900/10 p-3">
                <SectionTitle>What to look for in the results</SectionTitle>
                <JargonText
                  asBlock
                  inverse
                  text={step.what_to_look_for}
                  className="text-sm leading-relaxed text-green-100/90 whitespace-pre-line"
                />
              </div>
            </div>

            {/* Practice */}
            <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {step.terminal_mode ? (
                    <Terminal className="h-4 w-4 text-green-400" />
                  ) : (
                    <ClipboardList className="h-4 w-4 text-primary" />
                  )}
                  <h3 className="text-sm font-semibold">Practice</h3>
                </div>
                {!step.terminal_mode && blanks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <StageDots stage={stage} />
                    <span className="text-[11px] text-muted-foreground mono">
                      Stage {stage} of 3
                    </span>
                    {stage < 3 && (
                      <button
                        onClick={() => advanceStage(3)}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        data-testid="guide-skip-stage3"
                      >
                        Skip to Stage 3
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium">{step.practice_prompt}</p>

              {step.terminal_mode ? (
                <>
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
                  </div>
                  {feedback && feedback.kind === "ok" && (
                    <FeedbackOk msg={feedback.msg} />
                  )}
                  {feedback && feedback.kind === "fail" && (
                    <FeedbackFail hint={feedback.hint} missing={feedback.missing} />
                  )}
                </>
              ) : stage < 3 && blanks.length > 0 ? (
                // Stage 1 / Stage 2 — fill-in-the-blank.
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`stage-${stage}`}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    <pre
                      className="rounded border border-border p-3 font-mono text-sm text-slate-100 whitespace-pre overflow-x-auto leading-relaxed"
                      style={{ backgroundColor: "#0b1220" }}
                      data-testid={`guide-stage-${stage}`}
                    >
                      {querySegments?.map((seg, i) =>
                        seg.type === "text" ? (
                          <span key={i}>{seg.value}</span>
                        ) : (
                          <input
                            key={`blank-${seg.blankIdx}`}
                            value={blankInputs[seg.blankIdx ?? 0] ?? ""}
                            onChange={(e) => {
                              const idx = seg.blankIdx ?? 0;
                              setBlankInputs((prev) => {
                                const next = [...prev];
                                next[idx] = e.target.value;
                                return next;
                              });
                              setStageFeedback(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleBlankCheck();
                              }
                            }}
                            placeholder={"_".repeat(seg.value.length)}
                            spellCheck={false}
                            data-testid={`guide-blank-${seg.blankIdx}`}
                            className={`inline-block font-mono text-sm px-1 mx-0.5 text-white outline-none rounded ${
                              stageFeedback?.kind === "ok"
                                ? "bg-green-900/40 border-b-2 border-green-400"
                                : stageFeedback?.kind === "fail" &&
                                    stageFeedback.wrongIdx.includes(seg.blankIdx ?? 0)
                                  ? "bg-red-900/40 border-b-2 border-red-400"
                                  : "bg-[#1e3a5f] border-b-2 border-[#0078d4]"
                            }`}
                            style={{ width: `${Math.max(seg.value.length + 2, 6)}ch` }}
                          />
                        ),
                      )}
                    </pre>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={handleBlankCheck} data-testid="guide-check">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Check
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBlankInputs(
                            blanks
                              .slice(0, blanksForStage(stage))
                              .map((b) => b.keyword),
                          );
                          setStageFeedback({
                            kind: "ok",
                            msg: "Filled in for you — read it, then move on.",
                          });
                        }}
                        data-testid="guide-show"
                      >
                        <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Show me the answer
                      </Button>
                      {stageFeedback?.kind === "ok" && (
                        <Button
                          size="sm"
                          onClick={() => advanceStage(stage === 1 ? 2 : 3)}
                          className="ml-auto gap-1.5"
                          data-testid="guide-next-stage"
                        >
                          Next challenge <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {stageFeedback?.kind === "ok" && (
                      <FeedbackOk msg={stageFeedback.msg} />
                    )}
                    {stageFeedback?.kind === "fail" && (
                      <FeedbackFail hint={stageFeedback.msg} missing={[]} />
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                // Stage 3 — free-form textarea.
                <AnimatePresence mode="wait">
                  <motion.div
                    key="stage-3"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    <pre
                      className="rounded border border-border p-3 font-mono text-[12px] text-slate-400 whitespace-pre overflow-x-auto leading-relaxed"
                      style={{ backgroundColor: "#0b1220" }}
                    >
                      {commentScaffoldFor(runbookStep?.kql ?? "", step.practice_keywords)}
                    </pre>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={step.practice_placeholder}
                      rows={6}
                      className="w-full rounded border border-border p-2 font-mono text-sm text-slate-100 outline-none resize-y placeholder:text-slate-500"
                      style={{ backgroundColor: "#0b1220" }}
                      data-testid="guide-practice-input"
                      spellCheck={false}
                    />
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
                      {feedback?.kind === "ok" && step.tool === "sentinel" && onLoadQuery && (
                        <Button
                          size="sm"
                          onClick={handleLoadIntoEditor}
                          data-testid="guide-load"
                          className="ml-auto gap-1.5"
                        >
                          Load into Sentinel <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {feedback?.kind === "ok" && <FeedbackOk msg={feedback.msg} />}
                    {feedback?.kind === "fail" && (
                      <FeedbackFail hint={feedback.hint} missing={feedback.missing} />
                    )}
                  </motion.div>
                </AnimatePresence>
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

function StageDots({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            n <= stage ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function FeedbackOk({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded border border-green-700/40 bg-green-900/20 text-green-200/90 px-3 py-2 text-sm"
      data-testid="guide-feedback-ok"
    >
      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-400" />
      <span>{msg}</span>
    </motion.div>
  );
}

function FeedbackFail({ hint, missing }: { hint: string; missing: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded border border-amber-700/40 bg-amber-900/20 text-amber-100/90 px-3 py-2 text-sm space-y-2"
      data-testid="guide-feedback-fail"
    >
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
        <span>{hint}</span>
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          <span className="text-[10px] uppercase tracking-widest text-amber-200/70 mr-1">
            Missing:
          </span>
          {missing.map((k) => (
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
  );
}

/**
 * Stage 3 scaffold: turn the runbook KQL into a short comment block describing
 * what the query needs to do, so the analyst writes it from scratch.
 */
function commentScaffoldFor(kql: string, keywords: string[]): string {
  const k = (s: string) => keywords.some((kw) => kw.toLowerCase() === s.toLowerCase());
  const lines: string[] = ["// Write a KQL query that:"];
  // Heuristic bullets based on which keywords are expected.
  if (k("summarize") && k("count")) lines.push("//  • Counts rows grouped by a key field");
  if (k("dcount")) lines.push("//  • Counts DISTINCT values inside each group");
  if (k("countif")) lines.push("//  • Uses countif() with a condition (e.g. ResultType == \"0\")");
  if (k("where") || k("IPAddress") || k("UserPrincipalName")) {
    lines.push("//  • Filters with `where` on the key field for this alert");
  }
  if (k("sort")) lines.push("//  • Sorts the result with `sort by …`");
  if (lines.length === 1) {
    // Fallback — derive shape from the query itself.
    const tableMatch = kql.match(/^\s*([A-Za-z_]\w*)/);
    if (tableMatch) lines.push(`//  • Targets the ${tableMatch[1]} table`);
    lines.push("//  • Projects only the columns you need");
  }
  return lines.join("\n");
}
