// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { Layout } from "@/components/Layout";
import { MorganBubble } from "@/components/MorganBubble";
import { KqlEditor } from "@/components/KqlEditor";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import tutorial from "@/data/tutorial.json";
import mentor from "@/data/mentor.json";
import { useState, useMemo, useEffect } from "react";
import { runQuery } from "@/lib/kqlClient";
import { ResultsTable } from "@/components/ResultsTable";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

function renderMarkdown(src: string) {
  // Tiny markdown renderer: bold (**...**), inline code (`...`), code fences (```...```)
  const blocks: { kind: "p" | "code" | "ul"; text: string }[] = [];
  const fenceRe = /```(?:kql)?\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(src)) !== null) {
    if (m.index > last) blocks.push({ kind: "p", text: src.slice(last, m.index) });
    blocks.push({ kind: "code", text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < src.length) blocks.push({ kind: "p", text: src.slice(last) });

  return blocks.map((b, i) => {
    if (b.kind === "code") {
      return (
        <pre
          key={i}
          className="mono text-xs bg-background border border-border rounded p-3 overflow-x-auto"
        >
          {b.text}
        </pre>
      );
    }
    // paragraphs / list items
    const lines = b.text.split("\n");
    return (
      <div key={i} className="space-y-2">
        {lines.map((ln, j) => {
          if (!ln.trim()) return null;
          const isBullet = ln.trim().startsWith("- ");
          const content = ln.replace(/^- /, "");
          return (
            <p key={j} className={`text-sm leading-relaxed ${isBullet ? "pl-4 relative" : ""}`}>
              {isBullet && <span className="absolute left-0 text-primary">·</span>}
              <span dangerouslySetInnerHTML={{ __html: inlineMd(content) }} />
            </p>
          );
        })}
      </div>
    );
  });
}

function inlineMd(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="mono text-[12px] bg-muted px-1.5 py-0.5 rounded text-primary">$1</code>',
    );
}

export default function Learn() {
  const { data: progress = [] } = useQuery<any[]>({ queryKey: ["/api/tutorial/progress"] });
  const completedIds = useMemo(() => new Set(progress.map((p: any) => p.lessonId)), [progress]);

  const lessons = tutorial.lessons;
  const [idx, setIdx] = useState(() => {
    // Resume on first incomplete lesson
    return 0;
  });

  useEffect(() => {
    // jump to first unfinished
    const firstUnfinished = lessons.findIndex((l) => !completedIds.has(l.id));
    if (firstUnfinished >= 0) setIdx(firstUnfinished);
  }, [completedIds.size]); // eslint-disable-line

  const lesson = lessons[idx];

  const [query, setQuery] = useState("");
  useEffect(() => {
    // reset query when lesson changes
    setQuery("");
    setResult(null);
    setCheckOutcome(null);
  }, [idx]);

  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [checkOutcome, setCheckOutcome] = useState<"ok" | "fail" | null>(null);
  const [checkMessage, setCheckMessage] = useState("");

  const runIt = async () => {
    setRunning(true);
    const r = await runQuery(query);
    setResult(r);
    setRunning(false);
  };

  const completeMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tutorial/progress", { lessonId: lesson.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] }),
  });

  const checkAnswer = async () => {
    const r = await runQuery(query);
    setResult(r);
    if (r.error) {
      setCheckOutcome("fail");
      setCheckMessage(r.error);
      return;
    }
    const v = lesson.exercise.validator;
    const lower = query.toLowerCase();
    const missing = v.mustContain.filter((tok) => !lower.includes(tok.toLowerCase()));
    if (missing.length > 0) {
      setCheckOutcome("fail");
      setCheckMessage("Missing required token(s): " + missing.join(", "));
      return;
    }
    if (v.mustReturnRows && r.totalRows === 0) {
      setCheckOutcome("fail");
      setCheckMessage("Your query parsed and ran, but returned zero rows. Loosen a filter.");
      return;
    }
    setCheckOutcome("ok");
    setCheckMessage("That's the shape.");
    if (!completedIds.has(lesson.id)) completeMut.mutate();
  };

  const completionLines = (mentor.scripts.kql_lesson_complete as any)[lesson.id] || [];

  const allDone = lessons.every((l) => completedIds.has(l.id));

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-2">
              <GraduationCap className="h-3 w-3" /> KQL Tutorial
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{lesson.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              {lesson.estimatedMinutes} min read · {idx + 1} of {lessons.length}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lessons.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setIdx(i)}
                data-testid={`lesson-tab-${l.id}`}
                className={`h-8 w-8 rounded text-[11px] mono border ${
                  i === idx
                    ? "bg-primary text-primary-foreground border-primary"
                    : completedIds.has(l.id)
                      ? "bg-card border-primary/40 text-primary"
                      : "bg-card border-border text-muted-foreground"
                }`}
              >
                {l.id}
              </button>
            ))}
          </div>
        </header>

        {idx === 0 && !completedIds.has("L1") && (
          <MorganBubble lines={mentor.scripts.kql_intro} compact />
        )}

        <section className="bg-card border border-border rounded-lg p-6 space-y-5">
          <p className="text-sm italic text-muted-foreground leading-relaxed">{lesson.intro}</p>
          {lesson.sections.map((s, i) => (
            <div key={i} className="space-y-2">
              <h3 className="text-sm font-semibold tracking-tight">{s.heading}</h3>
              {renderMarkdown(s.body)}
            </div>
          ))}
        </section>

        <section className="bg-card border border-border rounded-lg p-6 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-primary">Your turn</div>
          <p className="text-sm leading-relaxed">{lesson.exercise.prompt}</p>
          <KqlEditor value={query} onChange={setQuery} onRun={runIt} minHeight="100px" />
          <div className="flex gap-2">
            <Button onClick={runIt} disabled={running} data-testid="btn-run">
              Run query
            </Button>
            <Button variant="outline" onClick={checkAnswer} data-testid="btn-check">
              Check my answer
            </Button>
            <details className="ml-auto">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Show hint
              </summary>
              <div className="absolute right-8 mt-2 max-w-md bg-popover border border-border rounded p-3 text-xs shadow-lg z-10">
                {lesson.exercise.hint}
              </div>
            </details>
          </div>
          {checkOutcome && (
            <div
              data-testid={`check-${checkOutcome}`}
              className={`flex items-start gap-2 text-sm border rounded px-3 py-2 ${
                checkOutcome === "ok"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              }`}
            >
              {checkOutcome === "ok" ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
              <span>{checkMessage}</span>
            </div>
          )}
          {result && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Results · {result.totalRows} rows · {result.executionMs?.toFixed(1)} ms
              </div>
              <ResultsTable columns={result.columns} rows={result.rows} maxHeight={200} />
            </div>
          )}
        </section>

        {checkOutcome === "ok" && completionLines.length > 0 && (
          <MorganBubble lines={completionLines} compact />
        )}

        <footer className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            data-testid="btn-prev-lesson"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-xs text-muted-foreground">
            {progress.length} of {lessons.length} complete
          </div>
          {idx < lessons.length - 1 ? (
            <Button
              onClick={() => setIdx((i) => Math.min(lessons.length - 1, i + 1))}
              data-testid="btn-next-lesson"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button asChild data-testid="btn-tutorial-done">
              <a href="#/queue">Open Alert Queue</a>
            </Button>
          )}
        </footer>

        {allDone && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-sm">
            Tutorial complete. Head to the Alert Queue.
          </div>
        )}
      </div>
    </Layout>
  );
}
