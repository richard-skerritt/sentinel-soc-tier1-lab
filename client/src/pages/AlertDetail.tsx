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
  Lightbulb,
  Sparkles,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileDown,
  Shield,
  Search as SearchIcon,
  Server,
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
  const [activeTab, setActiveTab] = useState<"editor" | "schema">("editor");
  const [rightTab, setRightTab] = useState<"notebook" | "triage">("triage");
  const [activeTool, setActiveTool] = useState<"sentinel" | "rapid7" | "elk" | "edr">("sentinel");
  const [runbookOpen, setRunbookOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("runbook_panel_open") !== "false";
    } catch {
      return true;
    }
  });
  const [mitreOpen, setMitreOpen] = useState(false);
  const [stackId, setStackId] = useState<string>(() => getActiveStackId());
  useEffect(() => {
    const handler = () => setStackId(getActiveStackId());
    window.addEventListener("tool-stack-changed", handler);
    return () => window.removeEventListener("tool-stack-changed", handler);
  }, []);
  const activeStack = useMemo(() => getActiveStack(), [stackId]);
  const stackSupported = useMemo(() => isStackFullySupported(stackId), [stackId]);

  const toggleRunbook = () => {
    setRunbookOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("runbook_panel_open", String(next));
      } catch {}
      return next;
    });
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
    setActiveTab("editor");
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
        <aside className="w-[36%] min-w-[360px] border-r border-border overflow-y-auto scrollbar-thin p-5 space-y-4">
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

          <div className="bg-card border border-border rounded p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-primary">Investigation Goals</div>
            <ul className="text-sm space-y-1.5">
              {alert.investigationGoals.map((g, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary mono text-xs mt-0.5">{i + 1}.</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={askHint}
              data-testid="btn-hint"
              className="w-full justify-start gap-2"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Ask Morgan for a hint
              <span className="ml-auto text-[10px] text-muted-foreground">{hintCount} used</span>
            </Button>
            {hintShown >= 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-100/90 leading-relaxed">
                {alert.hunterHints[hintShown]}
              </div>
            )}
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
          </div>
        </aside>

        {/* ===== Middle pane: Tools (Sentinel / Rapid7 / ELK / EDR) ===== */}
        <section className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
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
            <>
          <div className="flex items-center border-b border-border bg-muted/20 px-2">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 ${activeTab === "editor" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-editor"
            >
              <Code2 className="h-3 w-3" /> Editor
            </button>
            <button
              onClick={() => setActiveTab("schema")}
              className={`px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 ${activeTab === "schema" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-schema"
            >
              <Database className="h-3 w-3" /> Schema
            </button>
            <div className="ml-auto flex items-center gap-2 py-1">
              <Button size="sm" variant="ghost" onClick={saveCurrentQuery} data-testid="btn-save-notebook">
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button size="sm" onClick={runIt} disabled={running} data-testid="btn-run-query" className="gap-1.5">
                <Play className="h-3 w-3" /> Run (⌘↵)
              </Button>
            </div>
          </div>

          {activeTab === "editor" ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3">
                <KqlEditor value={query} onChange={setQuery} onRun={runIt} minHeight="160px" />
              </div>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-3 pb-3">
                {result?.error ? (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-xs text-destructive">
                    <div className="font-semibold mb-1">Query error</div>
                    <div className="mono">{result.error}</div>
                  </div>
                ) : result ? (
                  <>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex justify-between">
                      <span>Results</span>
                      <span className="mono normal-case">
                        {result.displayedRows} / {result.totalRows} rows · {result.executionMs?.toFixed(1)} ms
                      </span>
                    </div>
                    <div className="flex-1 min-h-0">
                      <ResultsTable
                        columns={result.columns}
                        rows={result.rows}
                        onCellClick={onCellClick}
                        maxHeight={500}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 border border-dashed border-border/50 rounded flex items-center justify-center text-xs text-muted-foreground">
                    Run a query to see results
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
              {alert.relatedTables.map((t) => (
                <div key={t} className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary mono">{t}</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                        <th className="text-left py-1 pr-3 font-medium w-48">Column</th>
                        <th className="text-left py-1 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tableSchemas[t] ?? []).map((c) => (
                        <tr key={c.name} className="border-b border-border/20">
                          <td className="py-1 pr-3 mono text-primary">{c.name}</td>
                          <td className="py-1 text-muted-foreground">{c.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </section>

        {/* ===== Right pane: Notebook / Triage ===== */}
        <aside className="w-[28%] min-w-[280px] flex flex-col overflow-hidden">
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
                              setActiveTab("editor");
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
        </aside>

        {/* ===== Far-right rail: Runbook ===== */}
        <RunbookPanel
          alertId={alert.id}
          alertCategory={alert.category}
          mitreId={alert.mitreId}
          isOpen={runbookOpen}
          onToggle={toggleRunbook}
        />

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

function EdrPanel({
  alert,
  stackAvailable,
  edrName,
}: {
  alert: Alert;
  stackAvailable: boolean;
  edrName: string;
}) {
  if (!stackAvailable) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <div className="text-sm text-foreground">{edrName}</div>
          <div>Not configured for the active tool stack.</div>
        </div>
      </div>
    );
  }
  const host =
    (alert.entities as Record<string, string>).host ??
    (alert.entities as Record<string, string>).srcHost ??
    (alert.entities as Record<string, string>).fileServer ??
    "—";
  return (
    <div className="flex-1 overflow-auto scrollbar-thin p-5 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {edrName} — Device summary
      </div>
      <div className="bg-card border border-border rounded p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-semibold mono text-sm">{host}</span>
        </div>
        <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Alert title</dt>
          <dd>{alert.ruleName}</dd>
          <dt className="text-muted-foreground">Severity</dt>
          <dd>{alert.alertSeverity}</dd>
          <dt className="text-muted-foreground">Category</dt>
          <dd>{alert.category}</dd>
          <dt className="text-muted-foreground">First seen</dt>
          <dd className="mono">{alert.displayedAt}</dd>
        </dl>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        Use the Sentinel tab for full timeline / process-tree queries. This pane shows the EDR's
        device-level summary only.
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
