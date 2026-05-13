import { Layout } from "@/components/Layout";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Link } from "wouter";
import alertsData from "@/data/alerts.json";
import type { Alert } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Circle, Inbox } from "lucide-react";

const alerts = alertsData as unknown as Alert[];

const SEV_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function Queue() {
  const { data: triages = [] } = useQuery<any[]>({ queryKey: ["/api/triage"] });
  const triageMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of triages) m[t.alertId] = t;
    return m;
  }, [triages]);

  const [sortKey, setSortKey] = useState<"severity" | "time" | "complexity">("severity");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  const sorted = useMemo(() => {
    let out = alerts.slice();
    if (filter === "open") out = out.filter((a) => !triageMap[a.id]);
    if (filter === "done") out = out.filter((a) => triageMap[a.id]);
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
  }, [sortKey, filter, triageMap]);

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

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium w-8"></th>
                <th className="text-left px-3 py-2 font-medium w-28">ID</th>
                <th className="text-left px-3 py-2 font-medium w-24">Severity</th>
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
                return (
                  <tr key={a.id} className="border-b border-border/40 hover:bg-muted/20">
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
