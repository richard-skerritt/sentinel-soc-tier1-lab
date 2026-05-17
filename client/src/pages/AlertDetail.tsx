import { Layout } from "@/components/Layout";
import { useParams, Link } from "wouter";
import alertsData from "@/data/alerts.json";
import type { Alert } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { KqlEditor } from "@/components/KqlEditor";
import { ResultsTable } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { runQuery } from "@/lib/kqlClient";
import { tableSchemas } from "@/data/tableSchemas";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import mentor from "@/data/mentor.json";
import { MorganBubble } from "@/components/MorganBubble";
import { RunbookPanel } from "@/components/RunbookPanel";
import { Rapid7Panel } from "@/components/Rapid7Panel";
import { ElkPanel } from "@/components/ElkPanel";
import { MitreDetailDialog } from "@/components/MitreDetailDialog";
import { ToolIntroBanner, INTRO_TEXT } from "@/components/ToolIntroBanner";
import {
  exportIncident,
  downloadIncidentReport,
  type QueryHistoryEntry,
} from "@/lib/exportIncident";
import {
  getActiveStack,
  getActiveStackId,
  isStackFullySupported,
} from "@/lib/toolStack";
import {
  Play,
  Save,
  Database,
  Code2,
  Notebook,
  Gavel,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileDown,
  Shield,
  Search as SearchIcon,
  Server,
  Calendar,
  Plus,
  Download,
  BarChart3,
  CircleAlert,
} from "lucide-react";

const alerts = alertsData as unknown as Alert[];

function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((v) => [Math.random(), v] as [number, T])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
}

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const alert = alerts.find((a) => a.id === id);

  if (!alert) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-sm text-muted-foreground">Alert not found.</p>
          <Link href="/queue">
            <a className="text-primary text-sm">← Back to queue</a>
          </Link>
        </div>
      </Layout>
    );
  }

  // ===== KQL state =====
  const [query, setQuery] = useState(alert.starterQuery);
  useEffect(() => setQuery(alert.starterQuery), [alert.id]);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [pivot, setPivot] = useState<{ col: string; value: any } | null>(null);
  const [bottomTab, setBottomTab] = useState<"results" | "schema" | "chart">("results");
  const [rightTab, setRightTab] = useState<"notebook" | "triage">("triage");
  const [activeTool, setActiveTool] = useState<"sentinel" | "rapid7" | "elk" | "edr">("sentinel");
  const [mitreOpen, setMitreOpen] = useState(false);
  const [stackId, setStackId] = useState<string>(() => getActiveStackId());
  useEffect(() => {
    const handler = () => setStackId(getActiveStackId());
    window.addEventListener("tool-stack-changed", handler);
    return () => window.removeEventListener("tool-stack-changed", handler);
  }, []);
  const activeStack = useMemo(() => getActiveStack(), [stackId]);
  const stackSupported = useMemo(() => isStackFullySupported(stackId), [stackId]);

  // ===== Right-column drag-to-resize =====
  const [rightWidth, setRightWidth] = useState<number>(() => {
    try {
      const v = localStorage.getItem("runbook_panel_width");
      if (v) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) return Math.max(340, Math.min(600, n));
      }
    } catch {}
    return 480;
  });
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(340, Math.min(600, window.innerWidth - ev.clientX));
      setRightWidth(w);
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setRightWidth((curr) => {
        try {
          localStorage.setItem("runbook_panel_width", String(curr));
        } catch {}
        return curr;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const runIt = async () => {
    setRunning(true);
    const r = await runQuery(query, { alertId: alert.id });
    setResult(r);
    setRunning(false);
  };

  // ===== Notebook =====
  const { data: notebook } = useQuery<any>({
    queryKey: ["/api/notebook", alert.id],
  });
  const [notes, setNotes] = useState("");
  const [savedQueries, setSavedQueries] = useState<{ label: string; query: string }[]>([]);
  useEffect(() => {
    if (notebook) {
      setNotes(notebook.notes ?? "");
      setSavedQueries(notebook.savedQueries ?? []);
    }
  }, [notebook]);

  const saveNotebookMut = useMutation({
    mutationFn: (data: { notes: string; savedQueries: any[] }) =>
      apiRequest("POST", `/api/notebook/${alert.id}`, data),
  });
  const persistNotebook = (n: string, sq: any[]) => {
    setNotes(n);
    setSavedQueries(sq);
    saveNotebookMut.mutate({ notes: n, savedQueries: sq });
  };

  const saveCurrentQuery = () => {
    const label = `Query ${savedQueries.length + 1}`;
    const next = [...savedQueries, { label, query }];
    persistNotebook(notes, next);
  };

  // ===== Triage =====
  const { data: existingTriage } = useQuery<any>({
    queryKey: ["/api/triage", alert.id],
    queryFn: async () => {
      try {
        const r = await apiRequest("GET", `/api/triage/${alert.id}`);
        return r.json();
      } catch {
        return null;
      }
    },
  });
  const [verdict, setVerdict] = useState<string>("");
  const [pickedActions, setPickedActions] = useState<string[]>([]);
  const [notesTri, setNotesTri] = useState("");
  const [submitted, setSubmitted] = useState<any>(null);
  const [aiBlurb, setAiBlurb] = useState<string | null>(null);

  useEffect(() => {
    if (existingTriage) {
      setVerdict(existingTriage.verdict);
      setPickedActions(existingTriage.actions ?? []);
      setNotesTri(existingTriage.notes ?? "");
      setSubmitted(existingTriage);
    } else {
      setVerdict("");
      setPickedActions([]);
      setNotesTri("");
      setSubmitted(null);
    }
  }, [alert.id, existingTriage?.alertId]);

  const allActions = useMemo(
    () => shuffle([...alert.correctActions, ...alert.redHerrings]),
    // Deliberately keep stable per alert
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alert.id],
  );

  const submitTri = useMutation({
    mutationFn: async (payload: any) =>
      apiRequest("POST", `/api/triage/${alert.id}`, payload).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/triage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/triage", alert.id] });
      setSubmitted(data);
    },
  });

  const submitTriage = () => {
    const correctSet = new Set(alert.correctActions.map((s) => s.toLowerCase()));
    const verdictRight = verdict.toLowerCase() === alert.groundTruthVerdict.toLowerCase();
    const pickedRight = pickedActions.filter((a) => correctSet.has(a.toLowerCase())).length;
    const wrongPicks = pickedActions.filter((a) => !correctSet.has(a.toLowerCase())).length;
    const missing = alert.correctActions.length - pickedRight;
    const fullyCorrect = verdictRight && missing === 0 && wrongPicks === 0;
    const partial = verdictRight && !fullyCorrect;
    submitTri.mutate({
      verdict,
      actions: pickedActions,
      notes: notesTri,
      correct: fullyCorrect ? 1 : 0,
      partial: partial ? 1 : 0,
    });
  };

  // ===== Hints =====
  const { data: hints = [] } = useQuery<any[]>({ queryKey: ["/api/triage/hints"] });
  const hintCount = hints.find((h: any) => h.alertId === alert.id)?.hintCount ?? 0;
  const incHint = useMutation({
    mutationFn: () => apiRequest("POST", "/api/triage/hint", { alertId: alert.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/triage/hints"] }),
  });

  const [hintShown, setHintShown] = useState<number>(-1);
  const askHint = () => {
    incHint.mutate();
    setHintShown((h) => Math.min(alert.hunterHints.length - 1, h + 1));
  };

  const explainAlert = () => {
    setAiBlurb(
      `${alert.groundTruthSummary} Playbook: ${alert.playbookReason} MITRE: ${alert.mitre.join(", ")}.`,
    );
  };

  // ===== Incident export =====
  const { data: queryHist = [] } = useQuery<any[]>({
    queryKey: ["/api/queryHistory", { alertId: alert.id }],
    queryFn: async () => {
      try {
        const r = await apiRequest("GET", `/api/queryHistory?alertId=${encodeURIComponent(alert.id)}`);
        return r.json();
      } catch {
        return [];
      }
    },
  });

  const handleExport = () => {
    if (!submitted) return;
    const history: QueryHistoryEntry[] = (queryHist ?? []).map((q: any) => ({
      query: q.query ?? "",
      executedAt: q.executedAt ?? q.createdAt ?? Date.now(),
      resultRows: q.resultRows ?? 0,
    }));
    const markdown = exportIncident(
      alert,
      {
        verdict: submitted.verdict,
        actions: submitted.actions ?? [],
        notes: submitted.notes ?? "",
        correct: submitted.correct,
        partial: submitted.partial,
        submittedAt: submitted.submittedAt,
      },
      history,
    );
    downloadIncidentReport(alert, markdown);
    try {
      navigator.clipboard.writeText(markdown);
    } catch {}
    apiRequest("POST", "/api/incident-reports", {
      alertId: alert.id,
      reportContent: markdown,
    }).catch(() => {});
  };

  // ===== Pivot menu =====
  const onCellClick = (col: string, value: any) => {
    setPivot({ col, value });
  };
  const closePivot = () => setPivot(null);
  const applyPivot = (newQuery: string) => {
    setQuery(newQuery);
    setPivot(null);
    setActiveTool("sentinel");
    setBottomTab("results");
  };

  // ===== Feedback after submit =====
  const feedbackKind = !submitted
    ? null
    : submitted.correct
      ? "correct"
      : submitted.partial
        ? "partial"
        : "wrong";

  const feedbackLines = useMemo(() => {
    if (!feedbackKind) return [];
    if (feedbackKind === "correct") return [mentor.scripts.feedback_correct[0]];
    if (feedbackKind === "partial") return [mentor.scripts.feedback_partial[0]];
    return [mentor.scripts.feedback_wrong_verdict[0]];
  }, [feedbackKind]);

  return (
    <Layout>
      <div className="flex h-full">
        {/* ===== Left pane ===== */}
        <aside className="w-[22%] min-w-[280px] border-r border-border overflow-y-auto scrollbar-thin p-5 space-y-4">
          <Link href="/queue">
            <a className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" /> Back to queue
            </a>
          </Link>
          <div>
            <div className="flex items-start gap-2 mb-2">
              <SeverityBadge severity={alert.alertSeverity} />
              <span className="text-[11px] mono text-muted-foreground">{alert.id}</span>
              <span className="text-[11px] mono text-muted-foreground">·</span>
              <span className="text-[11px] mono text-muted-foreground">{alert.displayedAt.replace("T", " ").replace("Z", " UTC")}</span>
            </div>
            <h1 className="text-base font-semibold leading-tight" data-testid="alert-rule-name">{alert.ruleName}</h1>
            <div className="text-xs text-muted-foreground mt-1">{alert.product}</div>
          </div>

          <p className="text-sm leading-relaxed">{alert.ruleDescription}</p>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Entities</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(alert.entities).map(([k, v]) => (
                <span key={k} className="mono text-[11px] bg-muted/40 border border-border rounded px-2 py-0.5">
                  <span className="text-muted-foreground">{k}:</span> {v}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">MITRE</div>
            <div className="flex flex-wrap gap-1.5">
              {alert.mitre.map((m) => {
                const id = m.split(" ")[0];
                return (
                  <button
                    key={m}
                    onClick={() => setMitreOpen(true)}
                    className="text-[11px] bg-primary/10 border border-primary/30 text-primary rounded px-2 py-0.5 hover:bg-primary/20 transition-colors cursor-pointer"
                    data-testid={`mitre-${id}`}
                    title="View MITRE technique detail"
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Category: <span className="text-foreground/80">{alert.category}</span>
            </div>
          </div>

          <InvestigationGoals alertId={alert.id} goals={alert.investigationGoals} />

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={explainAlert}
              disabled={!submitted}
              data-testid="btn-explain"
              className="w-full justify-start gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI explain this alert
              {!submitted && <span className="ml-auto text-[10px] text-muted-foreground">post-triage</span>}
            </Button>
            {aiBlurb && (
              <div className="bg-card border border-border rounded p-3 text-xs leading-relaxed">{aiBlurb}</div>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Need help? Use <span className="text-foreground/80">Ask Morgan</span> in the runbook on the right.
            </p>
          </div>
        </aside>

        {/* ===== Middle pane: Tools (Sentinel / Rapid7 / ELK / EDR) ===== */}
        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-stretch border-b border-border bg-muted/30 px-1">
            <ToolTab
              active={activeTool === "sentinel"}
              onClick={() => setActiveTool("sentinel")}
              icon={<Code2 className="h-3 w-3" />}
              label={`KQL (${activeStack.siem.replace("Microsoft ", "")})`}
              testId="tool-tab-sentinel"
            />
            <ToolTab
              active={activeTool === "rapid7"}
              onClick={() => setActiveTool("rapid7")}
              icon={<SearchIcon className="h-3 w-3" />}
              label={activeStack.xdr}
              testId="tool-tab-rapid7"
            />
            <ToolTab
              active={activeTool === "elk"}
              onClick={() => setActiveTool("elk")}
              icon={<Server className="h-3 w-3" />}
              label={activeStack.logPlatform}
              testId="tool-tab-elk"
            />
            <ToolTab
              active={activeTool === "edr"}
              onClick={() => setActiveTool("edr")}
              icon={<Shield className="h-3 w-3" />}
              label={`EDR (${activeStack.edr.split(" ").pop()})`}
              testId="tool-tab-edr"
            />
          </div>

          {activeTool === "rapid7" ? (
            <Rapid7Panel alertId={alert.id} stackAvailable={stackSupported} />
          ) : activeTool === "elk" ? (
            <ElkPanel alertId={alert.id} stackAvailable={stackSupported} />
          ) : activeTool === "edr" ? (
            <EdrPanel alert={alert} stackAvailable={stackSupported} edrName={activeStack.edr} />
          ) : (
            <SentinelPanel
              alert={alert}
              query={query}
              setQuery={setQuery}
              running={running}
              result={result}
              runIt={runIt}
              saveCurrentQuery={saveCurrentQuery}
              onCellClick={onCellClick}
              bottomTab={bottomTab}
              setBottomTab={setBottomTab}
            />
          )}
        </section>

        {/* ===== Drag handle between middle and right column ===== */}
        <div
          onMouseDown={startDrag}
          className="w-1 cursor-col-resize bg-border hover:bg-primary/60 active:bg-primary transition-colors shrink-0"
          data-testid="right-column-drag"
          title="Drag to resize"
        />

        {/* ===== Right column: Runbook (top) + Notebook/Triage (bottom) ===== */}
        <aside
          className="flex flex-col overflow-hidden border-l border-border shrink-0"
          style={{ width: rightWidth, minWidth: 340, maxWidth: 600 }}
          data-testid="right-column"
        >
          {/* Top: Runbook — always visible */}
          <div className="flex-[3] min-h-0 overflow-hidden border-b-2 border-border">
            <RunbookPanel
              alertId={alert.id}
              alertCategory={alert.category}
              mitreId={alert.mitreId}
              hintCount={hintCount}
              hintShown={hintShown}
              hunterHints={alert.hunterHints}
              onAskHint={askHint}
            />
          </div>

          {/* Bottom: Notebook / Triage */}
          <div className="flex-[2] min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-border bg-muted/20">
            <button
              onClick={() => setRightTab("notebook")}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 ${rightTab === "notebook" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-notebook"
            >
              <Notebook className="h-3 w-3" /> Notebook
            </button>
            <button
              onClick={() => setRightTab("triage")}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 ${rightTab === "triage" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-triage"
            >
              <Gavel className="h-3 w-3" /> Triage
            </button>
          </div>

          {rightTab === "notebook" ? (
            <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Scratchpad
                </div>
                <textarea
                  className="w-full bg-background border border-border rounded p-2 text-xs mono"
                  rows={6}
                  value={notes}
                  onChange={(e) => persistNotebook(e.target.value, savedQueries)}
                  placeholder="Working notes for this alert…"
                  data-testid="notebook-notes"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Saved queries
                </div>
                {savedQueries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No saved queries yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {savedQueries.map((q, i) => (
                      <li key={i} className="bg-card border border-border rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold">{q.label}</span>
                          <button
                            onClick={() => {
                              setQuery(q.query);
                              setActiveTool("sentinel");
                              setBottomTab("results");
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Load
                          </button>
                        </div>
                        <pre className="text-[10px] mono text-muted-foreground whitespace-pre-wrap line-clamp-3">
                          {q.query}
                        </pre>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : !submitted ? (
            <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Verdict
                </div>
                <div className="space-y-1">
                  {["True Positive", "False Positive", "Benign Positive"].map((v) => (
                    <label
                      key={v}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded border cursor-pointer text-sm ${
                        verdict === v
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        className="accent-primary"
                        checked={verdict === v}
                        onChange={() => setVerdict(v)}
                        data-testid={`verdict-${v.replace(/\s/g, "-")}`}
                      />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Actions
                </div>
                <div className="space-y-1">
                  {allActions.map((a) => (
                    <label
                      key={a}
                      className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5"
                        checked={pickedActions.includes(a)}
                        onChange={(e) => {
                          if (e.target.checked) setPickedActions([...pickedActions, a]);
                          else setPickedActions(pickedActions.filter((x) => x !== a));
                        }}
                        data-testid={`action-${a.replace(/\s/g, "-").slice(0, 30)}`}
                      />
                      <span className="leading-relaxed">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Notes
                </div>
                <textarea
                  className="w-full bg-background border border-border rounded p-2 text-xs"
                  rows={3}
                  value={notesTri}
                  onChange={(e) => setNotesTri(e.target.value)}
                  data-testid="triage-notes"
                />
              </div>
              <Button
                disabled={!verdict || submitTri.isPending}
                onClick={submitTriage}
                className="w-full"
                data-testid="btn-submit-triage"
              >
                Submit triage
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-3">
              <div
                className={`rounded border p-3 flex items-start gap-2 ${
                  feedbackKind === "correct"
                    ? "bg-primary/10 border-primary/40"
                    : feedbackKind === "partial"
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : "bg-destructive/10 border-destructive/40"
                }`}
              >
                {feedbackKind === "correct" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                ) : feedbackKind === "partial" ? (
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                )}
                <div className="text-sm">
                  <div className="font-semibold mb-0.5">
                    {feedbackKind === "correct"
                      ? "Correct triage"
                      : feedbackKind === "partial"
                        ? "Partial credit"
                        : "Incorrect"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ground truth: <strong className="text-foreground">{alert.groundTruthVerdict}</strong>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded p-3 text-xs leading-relaxed">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  What actually happened
                </div>
                {alert.groundTruthSummary}
              </div>
              <div className="bg-card border border-border rounded p-3 text-xs leading-relaxed">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Playbook reasoning
                </div>
                {alert.playbookReason}
              </div>
              <div className="bg-card border border-border rounded p-3 text-xs leading-relaxed space-y-1.5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Correct actions</div>
                {alert.correctActions.map((a) => (
                  <div key={a} className="flex gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="w-full gap-2"
                data-testid="btn-export-report"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export Report (.md)
              </Button>
              <MorganBubble lines={feedbackLines} compact />
            </div>
          )}
          </div>
        </aside>

        {/* ===== Pivot menu ===== */}
        {pivot && <PivotMenu pivot={pivot} onClose={closePivot} onApply={applyPivot} />}
      </div>

      <MitreDetailDialog
        mitreId={alert.mitreId}
        open={mitreOpen}
        onOpenChange={setMitreOpen}
      />
    </Layout>
  );
}

function ToolTab({
  active,
  onClick,
  icon,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 transition-colors ${
        active
          ? "border-primary text-primary bg-background"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function InvestigationGoals({ alertId, goals }: { alertId: string; goals: string[] }) {
  const storageKey = `goals_checked_${alertId}`;
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`goals_checked_${alertId}`);
      setChecked(new Set<number>(raw ? JSON.parse(raw) : []));
    } catch {
      setChecked(new Set());
    }
  }, [alertId]);

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const done = goals.filter((_, i) => checked.has(i)).length;
  const total = goals.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="bg-card border border-border rounded p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-primary">Investigation Goals</div>
        <span className="text-[10px] mono text-muted-foreground" data-testid="goals-progress">
          {done} of {total} checked
        </span>
      </div>
      <div className="h-1 bg-muted/40 rounded overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="text-sm space-y-1">
        {goals.map((g, i) => {
          const isDone = checked.has(i);
          return (
            <li key={i}>
              <label
                className={`flex items-start gap-2 px-1.5 py-1 rounded cursor-pointer ${
                  isDone ? "" : "hover:bg-muted/30"
                }`}
                data-testid={`goal-${i}`}
              >
                <input
                  type="checkbox"
                  className="accent-primary mt-1 shrink-0"
                  checked={isDone}
                  onChange={() => toggle(i)}
                />
                <span
                  className={`leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}
                >
                  {g}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SentinelPanel({
  alert,
  query,
  setQuery,
  running,
  result,
  runIt,
  saveCurrentQuery,
  onCellClick,
  bottomTab,
  setBottomTab,
}: {
  alert: Alert;
  query: string;
  setQuery: (s: string) => void;
  running: boolean;
  result: any;
  runIt: () => void;
  saveCurrentQuery: () => void;
  onCellClick: (col: string, value: any, row?: any) => void;
  bottomTab: "results" | "schema" | "chart";
  setBottomTab: (t: "results" | "schema" | "chart") => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ backgroundColor: "#0b1120" }}>
      {/* Azure portal header: breadcrumb + time range */}
      <div
        className="border-b px-4 py-2 flex items-center gap-3"
        style={{ backgroundColor: "#0b1120", borderColor: "#1f2d4a" }}
      >
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: "#8a9ab5" }}>Microsoft Sentinel</span>
          <ChevronRight className="h-3 w-3" style={{ color: "#4a5874" }} />
          <span style={{ color: "#8a9ab5" }}>nightshift-workspace</span>
          <ChevronRight className="h-3 w-3" style={{ color: "#4a5874" }} />
          <span className="font-medium text-white">Logs</span>
        </div>
        <div className="ml-auto">
          <button
            disabled
            className="text-xs rounded-full px-3 py-1 flex items-center gap-1.5 border cursor-default"
            style={{ color: "#cbd5e1", backgroundColor: "#1a2436", borderColor: "#2a3a5c" }}
            title="Frozen lab time"
          >
            <Calendar className="h-3 w-3" />
            2026-05-13  11:00 – 13:00  UTC
          </button>
        </div>
      </div>

      <ToolIntroBanner toolId="sentinel" message={INTRO_TEXT.sentinel} />

      {/* Azure command toolbar */}
      <div
        className="border-b px-3 py-1.5 flex items-center gap-1"
        style={{ backgroundColor: "#0e1527", borderColor: "#1f2d4a" }}
      >
        <button
          onClick={() => setQuery(alert.starterQuery)}
          className="text-xs rounded px-2 py-1 flex items-center gap-1.5 hover:bg-[#1a2436]"
          style={{ color: "#cbd5e1" }}
          data-testid="btn-new-query"
        >
          <Plus className="h-3 w-3" /> New query
        </button>
        <button
          disabled
          className="text-xs rounded px-2 py-1 flex items-center gap-1.5 cursor-not-allowed"
          style={{ color: "#5a6478" }}
          title="Save (lab no-op)"
        >
          <Save className="h-3 w-3" /> Save
        </button>
        <button
          disabled
          className="text-xs rounded px-2 py-1 flex items-center gap-1.5 cursor-not-allowed"
          style={{ color: "#5a6478" }}
          title="Export (lab no-op)"
        >
          <Download className="h-3 w-3" /> Export
        </button>
        <div className="ml-auto">
          <button
            onClick={runIt}
            disabled={running}
            data-testid="btn-run-query"
            className="text-xs rounded-full px-4 py-1 flex items-center gap-1.5 text-white font-medium disabled:opacity-60 hover:brightness-110"
            style={{ backgroundColor: "#0078d4" }}
          >
            <Play className="h-3 w-3" /> {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Query 1 card */}
      <div className="px-4 pt-3" style={{ backgroundColor: "#0b1120" }}>
        <div className="rounded border" style={{ borderColor: "#2a3a5c" }}>
          <div
            className="px-3 py-1.5 flex items-center justify-between border-b"
            style={{ backgroundColor: "#0e1527", borderColor: "#2a3a5c" }}
          >
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#8a9ab5" }}>
              Query 1
            </span>
            <button
              onClick={saveCurrentQuery}
              className="text-[10px] hover:underline"
              style={{ color: "#4faaff" }}
              data-testid="btn-save-notebook"
            >
              Save to notebook
            </button>
          </div>
          <div style={{ backgroundColor: "#0b1120" }}>
            <KqlEditor value={query} onChange={setQuery} onRun={runIt} minHeight="160px" />
          </div>
        </div>
      </div>

      {/* Results / Chart / Schema tabs */}
      <div className="px-4 pt-3" style={{ backgroundColor: "#0b1120" }}>
        <div
          className="flex items-center gap-1 border-b"
          style={{ borderColor: "#1f2d4a" }}
        >
          <AzureTab
            active={bottomTab === "results"}
            onClick={() => setBottomTab("results")}
            label="Results"
            testId="tab-results"
          />
          <AzureTab
            active={false}
            onClick={() => {}}
            label={
              <span className="inline-flex items-center gap-1 opacity-60">
                <BarChart3 className="h-3 w-3" /> Chart
              </span>
            }
            disabled
            title="Chart view not available in lab"
            testId="tab-chart"
          />
          <AzureTab
            active={bottomTab === "schema"}
            onClick={() => setBottomTab("schema")}
            label="Schema"
            testId="tab-schema"
          />
        </div>
      </div>

      {/* Tab content */}
      <div
        className="flex-1 overflow-hidden flex flex-col min-h-0 px-4 pb-3 pt-2"
        style={{ backgroundColor: "#0b1120" }}
      >
        {bottomTab === "schema" ? (
          <div className="flex-1 overflow-auto scrollbar-thin space-y-4 pr-1">
            {alert.relatedTables.map((t) => (
              <div key={t} className="space-y-2">
                <h3 className="text-sm font-semibold mono" style={{ color: "#4faaff" }}>
                  {t}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr
                      className="text-[10px] uppercase tracking-widest border-b"
                      style={{ color: "#8a9ab5", borderColor: "#1f2d4a" }}
                    >
                      <th className="text-left py-1 pr-3 font-medium w-48">Column</th>
                      <th className="text-left py-1 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tableSchemas[t] ?? []).map((c) => (
                      <tr key={c.name} className="border-b" style={{ borderColor: "#1f2d4a55" }}>
                        <td className="py-1 pr-3 mono" style={{ color: "#4faaff" }}>
                          {c.name}
                        </td>
                        <td className="py-1" style={{ color: "#8a9ab5" }}>
                          {c.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : result?.error ? (
          <div
            className="rounded p-3 text-xs"
            style={{ backgroundColor: "#3a1a1a", color: "#ff8080", border: "1px solid #5a2a2a" }}
          >
            <div className="font-semibold mb-1">Query error</div>
            <div className="mono">{result.error}</div>
          </div>
        ) : result ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <ResultsTable
                variant="azure"
                columns={result.columns}
                rows={result.rows}
                onCellClick={onCellClick}
                maxHeight={500}
              />
            </div>
            <div
              className="border-t mt-1.5 px-2 py-1 text-[10px] mono flex items-center justify-between"
              style={{ borderColor: "#1f2d4a", color: "#8a9ab5" }}
              data-testid="azure-status-bar"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" style={{ color: "#4ade80" }} />
                Completed
              </span>
              <span>
                {result.displayedRows} of {result.totalRows} rows · {result.executionMs?.toFixed(1)} ms
              </span>
            </div>
          </div>
        ) : (
          <div
            className="flex-1 rounded flex items-center justify-center text-xs"
            style={{
              border: "1px dashed #1f2d4a",
              color: "#8a9ab5",
            }}
          >
            Run a query to see results
          </div>
        )}
      </div>
    </div>
  );
}

function AzureTab({
  active,
  onClick,
  label,
  disabled = false,
  title,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
  testId?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      className={`px-3 py-1.5 text-xs border-b-2 -mb-px transition-colors ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{
        color: active ? "#ffffff" : disabled ? "#5a6478" : "#8a9ab5",
        borderColor: active ? "#0078d4" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function EdrPanel({
  alert,
  stackAvailable,
  edrName,
}: {
  alert: Alert;
  stackAvailable: boolean;
  edrName: string;
}) {
  const [edrTab, setEdrTab] = useState<
    "overview" | "timeline" | "alerts" | "recommendations" | "software"
  >("overview");

  if (!stackAvailable) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-xs text-slate-300"
        style={{ backgroundColor: "#1b1a1f" }}
      >
        <div className="text-center space-y-1">
          <div className="text-sm text-white">{edrName}</div>
          <div className="text-slate-400">Not configured for the active tool stack.</div>
        </div>
      </div>
    );
  }

  const entities = alert.entities as Record<string, string>;
  const host = entities.host ?? entities.srcHost ?? entities.fileServer ?? "—";
  const ip = entities.srcIp ?? "10.0.2.88";
  const user = entities.user ?? entities.assigningUser ?? "—";

  // Risk/exposure derived from the alert severity so the page reflects reality.
  const sev = alert.alertSeverity;
  const riskLevel =
    sev === "Critical" || sev === "High" ? "High" : sev === "Medium" ? "Medium" : "Low";
  const exposureLevel = sev === "Critical" ? "High" : "Medium";

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: "#1b1a1f", color: "#e6e6e6" }}
      data-testid="edr-panel"
    >
      {/* Microsoft Security header */}
      <div
        className="px-4 py-2 flex items-center gap-3 text-white"
        style={{
          background: "linear-gradient(90deg, #5c2d91 0%, #4527a0 60%, #0078d4 100%)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 grid grid-cols-2 grid-rows-2 gap-[1px]"
            aria-hidden
          >
            <span style={{ backgroundColor: "#f25022" }} />
            <span style={{ backgroundColor: "#7fba00" }} />
            <span style={{ backgroundColor: "#00a4ef" }} />
            <span style={{ backgroundColor: "#ffb900" }} />
          </span>
          <span className="text-xs font-semibold">Microsoft Defender</span>
        </div>
        <div className="text-[10px] opacity-80">security.microsoft.com</div>
        <div className="ml-auto text-[10px] mono opacity-80">contoso.onmicrosoft.com</div>
      </div>

      {/* Breadcrumb */}
      <div
        className="px-4 py-2 border-b flex items-center gap-2 text-xs"
        style={{ borderColor: "#3a3a40", backgroundColor: "#26252b" }}
      >
        <span className="text-slate-400">Device inventory</span>
        <ChevronRight className="h-3 w-3 text-slate-500" />
        <span className="text-white font-semibold mono">{host}</span>
      </div>

      <ToolIntroBanner toolId="edr" message={INTRO_TEXT.edr} />

      <div className="flex-1 overflow-auto scrollbar-thin">
        {/* Device card */}
        <div
          className="border-b px-5 py-4 flex gap-5"
          style={{ borderColor: "#3a3a40", backgroundColor: "#222127" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded flex items-center justify-center"
              style={{ backgroundColor: "#5c2d91" }}
            >
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-white mono">{host}</div>
              <div className="text-xs text-slate-400">Windows 10 22H2 · domain-joined · onboarded</div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">IP address</div>
              <div className="mono">{ip}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Logged-on user</div>
              <div className="mono">{user}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">First seen</div>
              <div className="mono">{alert.displayedAt}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Risk level</div>
              <RiskPill level={riskLevel} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Exposure level</div>
              <RiskPill level={exposureLevel} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">AV status</div>
              <span className="inline-block text-[10px] mono uppercase tracking-wider rounded px-2 py-0.5 border bg-emerald-900/30 border-emerald-500/40 text-emerald-300">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* MDE tab row */}
        <div
          className="px-4 border-b flex items-stretch"
          style={{ borderColor: "#3a3a40", backgroundColor: "#1b1a1f" }}
        >
          {([
            ["overview", "Overview"],
            ["alerts", "Alerts"],
            ["timeline", "Timeline"],
            ["recommendations", "Security recommendations"],
            ["software", "Software inventory"],
          ] as [typeof edrTab, string][]).map(([id, label]) => {
            const isReal = id === "overview" || id === "alerts";
            const isActive = edrTab === id;
            return (
              <button
                key={id}
                onClick={() => (isReal ? setEdrTab(id) : undefined)}
                disabled={!isReal}
                className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
                  isActive
                    ? "text-white font-medium"
                    : isReal
                    ? "text-slate-300 hover:text-white"
                    : "text-slate-500 cursor-not-allowed"
                }`}
                style={{ borderColor: isActive ? "#0078d4" : "transparent" }}
                data-testid={`edr-tab-${id}`}
                title={isReal ? undefined : "Not available in lab"}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5 space-y-5">
          {edrTab === "overview" ? (
            <>
              {/* Security assessments pills */}
              <div className="grid grid-cols-3 gap-3">
                <AssessmentCard
                  label="Risk level"
                  value={riskLevel}
                  tone={riskLevel === "High" ? "danger" : riskLevel === "Medium" ? "warn" : "ok"}
                  caption="Based on active alerts"
                />
                <AssessmentCard
                  label="Exposure level"
                  value={exposureLevel}
                  tone={exposureLevel === "High" ? "danger" : "warn"}
                  caption="Recommendations not applied"
                />
                <AssessmentCard
                  label="Antivirus"
                  value="Active"
                  tone="ok"
                  caption="Real-time protection ON"
                />
              </div>

              {/* Active alerts */}
              <Section title="Active alerts">
                <AlertRow alert={alert} />
              </Section>

              {/* Logged-on users */}
              <Section title="Logged-on users (last 30 days)">
                <div
                  className="rounded border"
                  style={{ borderColor: "#3a3a40", backgroundColor: "#222127" }}
                >
                  <div className="px-3 py-2 text-xs flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                      style={{ backgroundColor: "#5c2d91" }}
                    >
                      {user
                        .split("@")[0]
                        .split(".")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="mono">{user}</div>
                    <div className="ml-auto text-[10px] text-slate-400">Most recent</div>
                  </div>
                </div>
              </Section>
            </>
          ) : (
            <Section title="Alerts on this device">
              <AlertRow alert={alert} expanded />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RiskPill({ level }: { level: string }) {
  const tone =
    level === "High"
      ? "bg-red-900/30 border-red-500/40 text-red-300"
      : level === "Medium"
      ? "bg-amber-900/30 border-amber-500/40 text-amber-300"
      : "bg-emerald-900/30 border-emerald-500/40 text-emerald-300";
  return (
    <span
      className={`inline-block text-[10px] mono uppercase tracking-wider rounded px-2 py-0.5 border ${tone}`}
    >
      {level}
    </span>
  );
}

function AssessmentCard({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: "danger" | "warn" | "ok";
  caption: string;
}) {
  const accent =
    tone === "danger" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#10b981";
  return (
    <div
      className="rounded border p-3"
      style={{ borderColor: "#3a3a40", backgroundColor: "#222127", borderLeft: `4px solid ${accent}` }}
    >
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-sm font-semibold mt-1" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] text-slate-400 mt-1">{caption}</div>
    </div>
  );
}

function AlertRow({ alert, expanded = false }: { alert: Alert; expanded?: boolean }) {
  const sev = alert.alertSeverity;
  const sevTone =
    sev === "Critical"
      ? "bg-red-900/40 border-red-500/50 text-red-200"
      : sev === "High"
      ? "bg-orange-900/40 border-orange-500/50 text-orange-200"
      : sev === "Medium"
      ? "bg-amber-900/30 border-amber-500/40 text-amber-200"
      : "bg-slate-800/40 border-slate-500/40 text-slate-200";
  return (
    <div
      className="rounded border"
      style={{ borderColor: "#3a3a40", backgroundColor: "#222127" }}
    >
      <div className="px-3 py-2.5 flex items-start gap-3 text-xs">
        <CircleAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{alert.ruleName}</span>
            <span
              className={`text-[10px] mono uppercase tracking-wider rounded px-1.5 py-0.5 border ${sevTone}`}
            >
              {sev}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {alert.id} · {alert.product} · {alert.displayedAt}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            MITRE: {alert.mitre.join(", ")}
          </div>
          {expanded && (
            <div className="text-xs text-slate-300 mt-2 leading-relaxed">
              {alert.ruleDescription}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PivotMenu({
  pivot,
  onClose,
  onApply,
}: {
  pivot: { col: string; value: any };
  onClose: () => void;
  onApply: (q: string) => void;
}) {
  const { col, value } = pivot;
  const v = String(value);
  // Build a list of pivots based on the column name
  const pivots: { label: string; query: string }[] = [];
  const isIp = /ip/i.test(col) || /^\d+\.\d+\.\d+\.\d+$/.test(v);
  const isUser = /user|account|caller/i.test(col) || /@/.test(v);
  const isHost = /device|host|computer|src/i.test(col);
  const isHash = /sha256|hash/i.test(col) || /^[a-f0-9]{40,}$/i.test(v);
  const isDomain = /domain|url|host/i.test(col) && /\./.test(v);

  if (isIp) {
    pivots.push(
      { label: "SigninLogs by IP", query: `SigninLogs\n| where IPAddress == "${v}"\n| project TimeGenerated, UserPrincipalName, City, ResultType` },
      { label: "DeviceNetworkEvents by RemoteIP", query: `DeviceNetworkEvents\n| where RemoteIP == "${v}"\n| project Timestamp, DeviceName, RemotePort, BytesSent` },
      { label: "AzureActivity by CallerIp", query: `AzureActivity\n| where CallerIpAddress == "${v}"` },
      { label: "AzureFirewallNetworkRule by DstIP", query: `AzureFirewallNetworkRule\n| where DstIP == "${v}"` },
      { label: "Check ThreatIntelligenceIndicator", query: `ThreatIntelligenceIndicator\n| where IndicatorValue == "${v}"` },
    );
  }
  if (isUser) {
    pivots.push(
      { label: "SigninLogs for user", query: `SigninLogs\n| where UserPrincipalName == "${v}"\n| project TimeGenerated, IPAddress, City, ResultType` },
      { label: "OfficeActivity for user", query: `OfficeActivity\n| where UserId == "${v}"\n| project TimeGenerated, Operation, ClientIP` },
      { label: "DeviceProcessEvents for account", query: `DeviceProcessEvents\n| where AccountName contains "${v.split("@")[0]}"` },
    );
  }
  if (isHost) {
    pivots.push(
      { label: "DeviceProcessEvents on host", query: `DeviceProcessEvents\n| where DeviceName == "${v}"\n| project Timestamp, FileName, ProcessCommandLine, InitiatingProcessFileName\n| sort by Timestamp asc` },
      { label: "DeviceNetworkEvents on host", query: `DeviceNetworkEvents\n| where DeviceName == "${v}"\n| project Timestamp, RemoteIP, RemotePort, InitiatingProcessFileName` },
      { label: "SysmonEvent on host", query: `SysmonEvent\n| where Computer == "${v}"\n| project TimeGenerated, EventID, ProcessName` },
    );
  }
  if (isHash) {
    pivots.push({ label: "DeviceProcessEvents by SHA256", query: `DeviceProcessEvents\n| where SHA256 == "${v}"` });
  }
  if (isDomain) {
    pivots.push({ label: "DeviceNetworkEvents by hostname (free-text)", query: `DeviceNetworkEvents\n| where tostring(RemoteIP) contains "${v}"` });
  }
  if (pivots.length === 0) {
    // generic
    pivots.push({ label: `Find "${v}" anywhere (literal in raw cell)`, query: `// no direct pivot available for column ${col}` });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg p-4 max-w-md w-full max-h-[70vh] overflow-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pivot on value</div>
            <div className="mono text-sm text-primary">{col} = {v}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-1.5">
          {pivots.map((p, i) => (
            <li key={i}>
              <button
                onClick={() => onApply(p.query)}
                data-testid={`pivot-${i}`}
                className="w-full text-left bg-background border border-border rounded p-2 hover:border-primary/40 transition-colors"
              >
                <div className="text-xs font-medium">{p.label}</div>
                <pre className="mono text-[10px] text-muted-foreground whitespace-pre-wrap mt-1 line-clamp-3">
                  {p.query}
                </pre>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
