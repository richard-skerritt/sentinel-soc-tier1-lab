import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import elkData from "@/data/elk_responses.json";
import type { ElkEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ResponseEntry {
  events: ElkEvent[];
}

const responses = elkData as unknown as Record<string, ResponseEntry>;

interface ElkPanelProps {
  alertId: string;
  stackAvailable: boolean;
}

const COLUMNS: { key: keyof ElkEvent; label: string }[] = [
  { key: "@timestamp", label: "@timestamp" },
  { key: "event.category", label: "event.category" },
  { key: "source.ip", label: "source.ip" },
  { key: "destination.ip", label: "destination.ip" },
  { key: "user.name", label: "user.name" },
  { key: "event.outcome", label: "event.outcome" },
];

export function ElkPanel({ alertId, stackAvailable }: ElkPanelProps) {
  const entry = responses[alertId];
  const [query, setQuery] = useState("");
  const [ran, setRan] = useState(false);

  const rows: ElkEvent[] = useMemo(() => {
    if (!entry) return [];
    if (!ran || !query.trim()) return entry.events;
    const q = query.toLowerCase();
    return entry.events.filter((row) =>
      Object.values(row).some((v) => v && String(v).toLowerCase().includes(q)),
    );
  }, [entry, query, ran]);

  if (!stackAvailable) {
    return <ComingSoonOverlay product="ELK Stack" />;
  }
  if (!entry) {
    return (
      <div className="p-6 text-xs text-slate-300 bg-[#1d1e24] h-full">
        No ELK scripted response defined for alert <code className="mono">{alertId}</code>. Add one
        to <code className="mono">elk_responses.json</code>.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-t border-border"
      style={{ backgroundColor: "#1d1e24" }}
      data-testid="elk-panel"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ backgroundColor: "#16171b", borderColor: "#3a3f4b" }}
      >
        <div className="w-2 h-4 rounded-sm" style={{ backgroundColor: "#0077cc" }} />
        <span className="text-sm font-semibold text-white">Kibana — Discover</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-400 mono">
          Last 1 hour
        </span>
      </div>

      <div className="p-3 flex gap-2 border-b" style={{ borderColor: "#3a3f4b" }}>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="event.category: authentication AND source.ip: *"
            className="w-full pl-7 pr-2 py-1.5 mono text-xs rounded text-slate-100 outline-none"
            style={{ backgroundColor: "#0e0f12", border: "1px solid #3a3f4b" }}
            data-testid="elk-query"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setRan(true)}
          className="bg-[#0077cc] hover:bg-[#005fa3] text-white border-0"
          data-testid="elk-search"
        >
          Search
        </Button>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-[11px] mono text-slate-200">
          <thead className="sticky top-0" style={{ backgroundColor: "#16171b" }}>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key as string}
                  className="text-left px-2 py-1.5 font-medium text-slate-300 border-b"
                  style={{ borderColor: "#3a3f4b" }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-2 py-4 text-slate-400 text-center">
                  No results — refine the query.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-[#23252c] border-b"
                  style={{ borderColor: "#23252c" }}
                  data-testid={`elk-row-${i}`}
                >
                  {COLUMNS.map((c) => {
                    const v = row[c.key];
                    return (
                      <td key={c.key as string} className="px-2 py-1 align-top">
                        {v ? String(v) : <span className="text-slate-500">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComingSoonOverlay({ product }: { product: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-[#1d1e24] text-slate-300 border-t border-border">
      <div className="text-center space-y-2">
        <div className="text-base font-semibold">{product}</div>
        <div className="text-xs text-slate-400 max-w-xs">
          Not configured for the active tool stack. Switch back to the Nightshift default stack
          in Settings to use this panel.
        </div>
      </div>
    </div>
  );
}
