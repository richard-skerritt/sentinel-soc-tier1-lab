import { Fragment, useMemo, useState } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  User,
  Tag,
  Hash,
  Check,
  Plus,
} from "lucide-react";
import elkData from "@/data/elk_responses.json";
import type { ElkEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ToolIntroBanner, INTRO_TEXT } from "@/components/ToolIntroBanner";

interface ResponseEntry {
  events: ElkEvent[];
}

const responses = elkData as unknown as Record<string, ResponseEntry>;

interface ElkPanelProps {
  alertId: string;
  stackAvailable: boolean;
}

// Default columns when the panel first opens — matches what real Kibana shows by default.
const DEFAULT_COLUMNS: string[] = [
  "@timestamp",
  "event.category",
  "source.ip",
  "destination.ip",
  "user.name",
  "event.outcome",
];

function fieldType(field: string): "time" | "ip" | "user" | "category" | "outcome" | "other" {
  if (field === "@timestamp") return "time";
  if (field.endsWith(".ip")) return "ip";
  if (field === "user.name" || field.endsWith(".user") || field.endsWith(".username")) return "user";
  if (field === "event.category" || field === "event.action") return "category";
  if (field === "event.outcome") return "outcome";
  return "other";
}

function FieldIcon({ field, className }: { field: string; className?: string }) {
  const t = fieldType(field);
  switch (t) {
    case "time":
      return <Clock className={className} />;
    case "ip":
      return <Globe className={className} />;
    case "user":
      return <User className={className} />;
    case "category":
    case "outcome":
      return <Tag className={className} />;
    default:
      return <Hash className={className} />;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function shortTime(ts: string): string {
  // Render UTC HH:MM as the column for the histogram and table.
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function bucketHistogram(events: ElkEvent[], buckets = 12) {
  if (events.length === 0) return [] as { label: string; count: number; bucketStart: number }[];
  const times = events
    .map((e) => Date.parse(e["@timestamp"] ?? ""))
    .filter((n) => !Number.isNaN(n));
  if (times.length === 0) return [];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  const width = span / buckets;
  const out: { label: string; count: number; bucketStart: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = min + i * width;
    out.push({
      label: shortTime(new Date(start).toISOString()),
      count: 0,
      bucketStart: start,
    });
  }
  for (const t of times) {
    const idx = Math.min(buckets - 1, Math.floor((t - min) / width));
    out[idx].count += 1;
  }
  return out;
}

export function ElkPanel({ alertId, stackAvailable }: ElkPanelProps) {
  const entry = responses[alertId];
  const [query, setQuery] = useState("");
  const [ran, setRan] = useState(false);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // All fields present across the events, deduplicated.
  const allFields = useMemo(() => {
    if (!entry) return [] as string[];
    const set = new Set<string>();
    for (const e of entry.events) {
      for (const k of Object.keys(e)) set.add(k);
    }
    // Stable ordering: defaults first, then alphabetical extras.
    const fixed = DEFAULT_COLUMNS.filter((f) => set.has(f));
    const extra = Array.from(set)
      .filter((f) => !DEFAULT_COLUMNS.includes(f))
      .sort();
    return [...fixed, ...extra];
  }, [entry]);

  const fieldCounts = useMemo(() => {
    if (!entry) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const e of entry.events) {
      for (const [k, v] of Object.entries(e)) {
        if (v !== undefined && v !== null && v !== "") counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return counts;
  }, [entry]);

  const filteredEvents = useMemo(() => {
    if (!entry) return [] as ElkEvent[];
    if (!ran || !query.trim()) return entry.events;
    const q = query.toLowerCase();
    return entry.events.filter((e) =>
      Object.values(e).some((v) => v !== undefined && v !== null && String(v).toLowerCase().includes(q)),
    );
  }, [entry, query, ran]);

  const histogram = useMemo(() => bucketHistogram(filteredEvents, 12), [filteredEvents]);

  if (!stackAvailable) return <ComingSoonOverlay product="ELK Stack" />;
  if (!entry) {
    return (
      <div className="p-6 text-xs text-slate-300 bg-[#1d1e24] h-full">
        No ELK scripted response defined for alert <code className="mono">{alertId}</code>. Add one
        to <code className="mono">elk_responses.json</code>.
      </div>
    );
  }

  const toggleColumn = (field: string) => {
    setColumns((cur) =>
      cur.includes(field) ? cur.filter((f) => f !== field) : [...cur, field],
    );
  };
  const toggleExpanded = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-t border-border"
      style={{ backgroundColor: "#1d1e24" }}
      data-testid="elk-panel"
    >
      {/* Kibana top nav */}
      <div
        className="flex items-center gap-1 px-2 border-b"
        style={{ backgroundColor: "#16171b", borderColor: "#3a3f4b" }}
      >
        <div className="flex items-center gap-2 pr-3 py-2 mr-1 border-r" style={{ borderColor: "#3a3f4b" }}>
          <div
            className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ backgroundColor: "#0077cc" }}
          >
            K
          </div>
          <span className="text-xs text-slate-300">elastic</span>
        </div>
        {[
          { id: "discover", label: "Discover", active: true },
          { id: "dashboard", label: "Dashboard" },
          { id: "visualize", label: "Visualize" },
          { id: "devtools", label: "Dev Tools" },
        ].map((item) => (
          <button
            key={item.id}
            disabled={!item.active}
            className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
              item.active
                ? "text-white font-medium"
                : "text-slate-500 cursor-not-allowed"
            }`}
            style={{ borderColor: item.active ? "#0077cc" : "transparent" }}
            title={item.active ? undefined : "Not available in lab"}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] mono text-slate-500 pr-3">
          index: nightshift-* · 2026-05-13 11:00 – 13:00 UTC
        </span>
      </div>

      <ToolIntroBanner toolId="elk" message={INTRO_TEXT.elk} />

      <div className="flex-1 flex min-h-0">
        {/* Field list sidebar */}
        <aside
          className="w-[180px] border-r overflow-auto scrollbar-thin"
          style={{ backgroundColor: "#16171b", borderColor: "#3a3f4b" }}
          data-testid="elk-field-list"
        >
          <div className="text-[10px] uppercase tracking-widest text-slate-400 px-3 pt-3 pb-1.5">
            Available fields
          </div>
          {allFields.map((field) => {
            const inUse = columns.includes(field);
            return (
              <button
                key={field}
                onClick={() => toggleColumn(field)}
                className={`group w-full flex items-center gap-1.5 px-3 py-1 text-[11px] mono text-left ${
                  inUse ? "bg-[#23252c] text-white" : "text-slate-300 hover:bg-[#23252c]/70"
                }`}
                data-testid={`elk-field-${field}`}
              >
                <FieldIcon field={field} className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="flex-1 truncate">{field}</span>
                <span className="text-[10px] text-slate-500 mono">{fieldCounts[field] ?? 0}</span>
                {inUse ? (
                  <Check className="h-3 w-3 text-[#0077cc]" />
                ) : (
                  <Plus className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100" />
                )}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Search bar */}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") setRan(true);
                }}
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

          {/* Hit count */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: "#3a3f4b" }}
            data-testid="elk-hit-count"
          >
            <span className="text-lg font-semibold" style={{ color: "#0077cc" }}>
              {filteredEvents.length.toLocaleString()}
            </span>
            <span className="text-slate-300 text-xs ml-2">hits</span>
          </div>

          {/* Time histogram */}
          <div
            className="px-3 pb-2 pt-1 border-b"
            style={{ borderColor: "#3a3f4b" }}
            data-testid="elk-histogram"
          >
            <div style={{ width: "100%", height: 80 }}>
              <ResponsiveContainer>
                <BarChart data={histogram} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <YAxis
                    tick={{ fontSize: 10, fill: "#8a9099" }}
                    width={28}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#23252c" }}
                    contentStyle={{
                      backgroundColor: "#16171b",
                      border: "1px solid #3a3f4b",
                      fontSize: "11px",
                      color: "#cbd5e1",
                    }}
                    formatter={(value: any) => [`${value} hits`, "count"]}
                    labelFormatter={(label: any) => `${label} UTC`}
                  />
                  <Bar dataKey="count" fill="#0077cc" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Results table */}
          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full text-[11px] mono text-slate-200">
              <thead
                className="sticky top-0 z-10"
                style={{ backgroundColor: "#16171b" }}
              >
                <tr>
                  <th
                    className="text-left px-2 py-1.5 font-medium text-slate-300 border-b w-6"
                    style={{ borderColor: "#3a3f4b" }}
                  ></th>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="text-left px-2 py-1.5 font-medium text-slate-300 border-b"
                      style={{ borderColor: "#3a3f4b" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-2 py-4 text-slate-400 text-center">
                      No results — refine the query.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((row, i) => {
                    const isExp = expanded.has(i);
                    return (
                      <Fragment key={i}>
                        <tr
                          className="hover:bg-[#23252c] border-b cursor-pointer"
                          style={{ borderColor: "#23252c" }}
                          onClick={() => toggleExpanded(i)}
                          data-testid={`elk-row-${i}`}
                        >
                          <td className="px-2 py-1 align-top">
                            {isExp ? (
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-slate-400" />
                            )}
                          </td>
                          {columns.map((c) => {
                            const v = (row as any)[c];
                            return (
                              <td key={c} className="px-2 py-1 align-top">
                                {v !== undefined && v !== null && v !== "" ? (
                                  String(v)
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {isExp && (
                          <tr
                            className="border-b"
                            style={{ borderColor: "#23252c", backgroundColor: "#16171b" }}
                          >
                            <td colSpan={columns.length + 1} className="px-3 py-2">
                              <div className="grid grid-cols-[180px_1fr] gap-x-3 gap-y-1 text-[11px] mono">
                                {allFields.map((k, idx) => {
                                  const v = (row as any)[k];
                                  if (v === undefined || v === null || v === "") return null;
                                  return (
                                    <Fragment key={`${i}-${k}`}>
                                      <div
                                        className={`text-slate-400 ${idx % 2 === 1 ? "bg-[#1a1c20]" : ""}`}
                                      >
                                        {k}
                                      </div>
                                      <div
                                        className={`text-slate-100 break-all ${idx % 2 === 1 ? "bg-[#1a1c20]" : ""}`}
                                      >
                                        {String(v)}
                                      </div>
                                    </Fragment>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
