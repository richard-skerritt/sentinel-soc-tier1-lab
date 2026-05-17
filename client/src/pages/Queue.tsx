import { Layout } from "@/components/Layout";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Link } from "wouter";
import alertsData from "@/data/alerts.json";
import type { Alert } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Circle, Inbox, ArrowRight, X } from "lucide-react";

const alerts = alertsData as unknown as Alert[];

const SEV_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type Difficulty = "Starter" | "Intermediate" | "Advanced";

const STARTER_CATEGORIES = new Set(["authentication", "phishing"]);
const ADVANCED_CATEGORIES = new Set(["lateral-movement", "privilege-escalation"]);

function getDifficulty(alert: Alert): Difficulty {
  if (ADVANCED_CATEGORIES.has(alert.category)) return "Advanced";
  if (STARTER_CATEGORIES.has(alert.category)) return "Starter";
  return "Intermediate";
}

const DIFFICULTY_PILL: Record<Difficulty, string> = {
  Starter: "bg-green-900/30 text-green-400 border-green-700/40",
  Intermediate: "bg-blue-900/30 text-blue-400 border-blue-700/40",
  Advanced: "bg-purple-900/30 text-purple-400 border-purple-700/40",
};

export default function Queue() {
  const { data: triages = [] } = useQuery<any[]>({ queryKey: ["/api/triage"] });
  const triageMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of triages) m[t.alertId] = t;
    return m;
  }, [triages]);

  const [sortKey, setSortKey] = useState<"severity" | "time" | "complexity">("severity");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | Difficulty>(() => {
    try {
      const raw = localStorage.getItem("queue_difficulty_filter");
      if (raw === "Starter" || raw === "Intermediate" || raw === "Advanced") return raw;
    } catch {}
    return "All";
  });
  useEffect(() => {
    try {
      localStorage.setItem("queue_difficulty_filter", difficultyFilter);
    } catch {}
  }, [difficultyFilter]);

  const [showSuggestionBanner, setShowSuggestionBanner] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("queue_first_visit") === "true";
      if (!seen) setShowSuggestionBanner(true);
    } catch {}
  }, []);
  const dismissSuggestion = () => {
    try {
      localStorage.setItem("queue_first_visit", "true");
    } catch {}
    setShowSuggestionBanner(false);
  };

  const firstStarterId = useMemo(() => {
    const list = alerts
      .slice()
      .sort((a, b) => (SEV_RANK[a.alertSeverity] ?? 9) - (SEV_RANK[b.alertSeverity] ?? 9));
    return list.find((a) => getDifficulty(a) === "Starter")?.id ?? null;
  }, []);

  const sorted = useMemo(() => {
    let out = alerts.slice();
    if (filter === "open") out = out.filter((a) => !triageMap[a.id]);
    if (filter === "done") out = out.filter((a) => triageMap[a.id]);
    if (difficultyFilter !== "All") {
      out = out.filter((a) => getDifficulty(a) === difficultyFilter);
    }
    if (sortKey === "severity") {
      out.sort((a, b) => {
        const r = (SEV_RANK[a.alertSeverity] ?? 9) - (SEV_RANK[b.alertSeverity] ?? 9);
        if (r) return r;
        return a.displayedAt.localeCompare(b.displayedAt);
      });
    } else if (sortKey === "time") {
      out.sort((a, b) => a.displayedAt.localeCompare(b.displayedAt));
    } else {
      // complexity: by number of relatedTables ascending
      out.sort((a, b) => a.relatedTables.length - b.relatedTables.length);
    }
    return out;
  }, [sortKey, filter, difficultyFilter, triageMap]);

  return (
    <Layout>
      <div className="p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
              <Inbox className="h-3 w-3" /> Alert Queue
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {alerts.length} incidents
            </h1>
          </div>
          <div className="flex gap-2 items-center">
            <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} testid="filter-all" />
            <FilterChip label="Open" active={filter === "open"} onClick={() => setFilter("open")} testid="filter-open" />
            <FilterChip label="Triaged" active={filter === "done"} onClick={() => setFilter("done")} testid="filter-done" />
            <div className="w-px h-5 bg-border mx-1" />
            <FilterChip label="Severity" active={sortKey === "severity"} onClick={() => setSortKey("severity")} testid="sort-severity" />
            <FilterChip label="Time" active={sortKey === "time"} onClick={() => setSortKey("time")} testid="sort-time" />
            <FilterChip label="Recommended order" active={sortKey === "complexity"} onClick={() => setSortKey("complexity")} testid="sort-complexity" />
          </div>
        </header>

        {showSuggestionBanner && firstStarterId && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              borderColor: "rgba(34, 197, 94, 0.35)",
              color: "#bbf7d0",
            }}
            data-testid="queue-suggestion-banner"
          >
            <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "#4ade80" }} />
            <span className="flex-1">
              <span className="font-semibold">Start here →</span> Open a{" "}
              <span className="text-green-300">Starter</span> alert (highlighted below) to learn
              the investigation flow before tackling harder ones.
            </span>
            <Link href={`/alert/${firstStarterId}`}>
              <a className="text-green-300 hover:text-green-200 text-xs font-semibold underline underline-offset-2">
                Open {firstStarterId}
              </a>
            </Link>
            <button
              onClick={dismissSuggestion}
              className="text-green-400/60 hover:text-green-200"
              title="Dismiss"
              data-testid="queue-suggestion-dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">
            Difficulty
          </span>
          {(["All", "Starter", "Intermediate", "Advanced"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              data-testid={`difficulty-filter-${d}`}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                difficultyFilter === d
                  ? d === "All"
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : DIFFICULTY_PILL[d as Difficulty]
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium w-8"></th>
                <th className="text-left px-3 py-2 font-medium w-28">ID</th>
                <th className="text-left px-3 py-2 font-medium w-24">Severity</th>
                <th className="text-left px-3 py-2 font-medium w-28">Difficulty</th>
                <th className="text-left px-3 py-2 font-medium">Rule name</th>
                <th className="text-left px-3 py-2 font-medium w-44">Product</th>
                <th className="text-left px-3 py-2 font-medium w-28">Displayed</th>
                <th className="text-left px-3 py-2 font-medium w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const t = triageMap[a.id];
                const status = !t ? "Open" : t.correct ? "Correct" : t.partial ? "Partial" : "Incorrect";
                const difficulty = getDifficulty(a);
                const isHighlightedStarter =
                  showSuggestionBanner && firstStarterId === a.id;
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-border/40 hover:bg-muted/20 ${
                      isHighlightedStarter ? "bg-green-900/10 ring-1 ring-inset ring-green-500/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      {status === "Open" ? (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : status === "Correct" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </td>
                    <td className="px-3 py-2 mono text-xs">
                      <Link href={`/alert/${a.id}`}>
                        <a
                          data-testid={`alert-link-${a.id}`}
                          className="text-primary hover:underline"
                        >
                          {a.id}
                        </a>
                      </Link>
                    </td>
                    <td className="px-3 py-2"><SeverityBadge severity={a.alertSeverity} /></td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block text-[10px] mono uppercase tracking-wider rounded-full border px-2 py-0.5 ${DIFFICULTY_PILL[difficulty]}`}
                        data-testid={`difficulty-pill-${a.id}`}
                      >
                        {difficulty}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/alert/${a.id}`}>
                        <a className="hover:text-primary">{a.ruleName}</a>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{a.product}</td>
                    <td className="px-3 py-2 mono text-xs text-muted-foreground">
                      {a.displayedAt.slice(11, 16)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={
                          status === "Open"
                            ? "text-muted-foreground"
                            : status === "Correct"
                              ? "text-primary"
                              : status === "Partial"
                                ? "text-yellow-400"
                                : "text-destructive"
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  testid,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
