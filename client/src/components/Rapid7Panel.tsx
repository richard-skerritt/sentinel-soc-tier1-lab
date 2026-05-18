// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { Fragment, useMemo, useState } from "react";
import {
  Search,
  Shield,
  AlertTriangle,
  Calendar,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  ListFilter,
} from "lucide-react";
import rapid7Data from "@/data/rapid7_responses.json";
import type { Rapid7AssetRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ToolIntroBanner, INTRO_TEXT } from "@/components/ToolIntroBanner";

interface ResponseEntry {
  logs: string[];
  asset: Rapid7AssetRecord;
}

const responses = rapid7Data as unknown as Record<string, ResponseEntry>;

interface Rapid7PanelProps {
  alertId: string;
  stackAvailable: boolean;
}

type Rapid7Tab =
  | "investigations"
  | "log_search"
  | "dashboards"
  | "reports"
  | "users"
  | "assets";

type LogSet = "Authentication" | "Network Traffic" | "Endpoint" | "Application";

function parseKeyValue(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w[\w.]*)\s*=\s*("[^"]*"|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const k = m[1];
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function classifyLogSet(parsed: Record<string, string>): LogSet {
  const t = (parsed.event_type ?? "").toLowerCase();
  if (
    t.includes("auth") ||
    t.includes("oauth") ||
    t.includes("mailbox") ||
    t.includes("role")
  )
    return "Authentication";
  if (t.includes("network") || t.includes("firewall") || t.includes("dns")) return "Network Traffic";
  if (t.includes("inbox_rule") || t.includes("oauth_token")) return "Application";
  return "Endpoint";
}

function logSummary(parsed: Record<string, string>, rawLine: string): string {
  const event = parsed.event_type ?? "event";
  const user = parsed.destination_user ?? parsed.user ?? parsed.mailbox ?? "";
  const src = parsed.source_ip ?? parsed.asset ?? parsed.source_host ?? "";
  const dst = parsed.destination_ip ?? "";
  const action = parsed.action ?? parsed.result ?? parsed.operation ?? "";
  const parts = [event, src && `src=${src}`, dst && `dst=${dst}`, user && `user=${user}`, action]
    .filter(Boolean)
    .join("  ");
  return parts || rawLine;
}

function logSetTone(set: LogSet) {
  switch (set) {
    case "Authentication":
      return { bg: "#3f1d1d", fg: "#ff8b8b", border: "#5a2828" };
    case "Network Traffic":
      return { bg: "#1d2e3f", fg: "#7fb6ff", border: "#28425a" };
    case "Endpoint":
      return { bg: "#2a1d3f", fg: "#c39bff", border: "#3f2a5a" };
    case "Application":
      return { bg: "#1d3f2e", fg: "#7fffb5", border: "#285a3f" };
  }
}

export function Rapid7Panel({ alertId, stackAvailable }: Rapid7PanelProps) {
  const entry = responses[alertId];
  const [tab, setTab] = useState<Rapid7Tab>("log_search");
  const [query, setQuery] = useState("");
  const [ran, setRan] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeLogSet, setActiveLogSet] = useState<LogSet | "all">("all");

  const parsedLogs = useMemo(() => {
    if (!entry) return [] as { line: string; parsed: Record<string, string>; set: LogSet }[];
    return entry.logs.map((line) => {
      const parsed = parseKeyValue(line);
      return { line, parsed, set: classifyLogSet(parsed) };
    });
  }, [entry]);

  const filtered = useMemo(() => {
    if (!entry) return parsedLogs;
    return parsedLogs.filter((p) => {
      if (activeLogSet !== "all" && p.set !== activeLogSet) return false;
      if (ran && query.trim()) {
        const q = query.toLowerCase();
        if (!p.line.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [parsedLogs, entry, query, ran, activeLogSet]);

  const logSetCounts = useMemo(() => {
    const counts: Record<LogSet, number> = {
      Authentication: 0,
      "Network Traffic": 0,
      Endpoint: 0,
      Application: 0,
    };
    for (const p of parsedLogs) counts[p.set] += 1;
    return counts;
  }, [parsedLogs]);

  if (!stackAvailable) {
    return <ComingSoonOverlay product="Rapid7 InsightIDR" />;
  }
  if (!entry) {
    return (
      <div className="p-6 text-xs text-slate-300 bg-[#0f1729] h-full">
        No Rapid7 scripted response defined for alert <code className="mono">{alertId}</code>. Add
        one to <code className="mono">rapid7_responses.json</code>.
      </div>
    );
  }

  const { asset } = entry;
  const riskColour =
    asset.riskScore === "high"
      ? "bg-red-900/30 border-red-500/50 text-red-300"
      : asset.riskScore === "medium"
      ? "bg-amber-900/30 border-amber-500/50 text-amber-300"
      : "bg-emerald-900/30 border-emerald-500/50 text-emerald-300";

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
      style={{ backgroundColor: "#0f1729" }}
      data-testid="rapid7-panel"
    >
      {/* Product header */}
      <div
        className="flex items-center gap-3 px-3 py-2 border-b"
        style={{ backgroundColor: "#1a2332", borderColor: "#23314f" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-sm" style={{ backgroundColor: "#e5402a" }} />
          <span className="text-sm font-semibold text-white">Rapid7 InsightIDR</span>
        </div>
        <div className="ml-auto text-[10px] mono text-slate-400">
          nightshift-org · realm-uk-1
        </div>
      </div>

      <ToolIntroBanner toolId="rapid7" message={INTRO_TEXT.rapid7} />

      {/* Secondary nav */}
      <div
        className="flex items-stretch border-b px-2"
        style={{ backgroundColor: "#0f1729", borderColor: "#23314f" }}
      >
        {([
          ["investigations", "Investigations"],
          ["log_search", "Log Search"],
          ["dashboards", "Dashboards"],
          ["reports", "Reports"],
          ["users", "Users"],
          ["assets", "Assets"],
        ] as [Rapid7Tab, string][]).map(([id, label]) => {
          const isReal = id === "log_search" || id === "assets";
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => (isReal ? setTab(id) : undefined)}
              disabled={!isReal}
              className={`text-xs px-3 py-2 border-b-2 transition-colors ${
                isActive
                  ? "border-[#e5402a] text-white"
                  : isReal
                  ? "border-transparent text-slate-300 hover:text-white"
                  : "border-transparent text-slate-500 cursor-not-allowed"
              }`}
              data-testid={`rapid7-nav-${id}`}
              title={isReal ? undefined : "Not available in lab"}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "log_search" ? (
        <div className="flex-1 flex min-h-0">
          {/* Log Sets sidebar */}
          <aside
            className="w-[150px] border-r overflow-auto scrollbar-thin"
            style={{ backgroundColor: "#0a1220", borderColor: "#23314f" }}
            data-testid="rapid7-log-sets"
          >
            <div
              className="text-[10px] uppercase tracking-widest text-slate-400 px-3 pt-3 pb-1 flex items-center gap-1"
            >
              <ListFilter className="h-3 w-3" /> Log Sets
            </div>
            <button
              onClick={() => setActiveLogSet("all")}
              className={`w-full text-left px-3 py-1.5 text-xs flex justify-between items-center ${
                activeLogSet === "all"
                  ? "bg-[#1a2332] text-white"
                  : "text-slate-300 hover:bg-[#1a2332]/60"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] text-slate-400 mono">{parsedLogs.length}</span>
            </button>
            {(Object.keys(logSetCounts) as LogSet[]).map((set) => {
              const tone = logSetTone(set);
              const isActive = activeLogSet === set;
              return (
                <button
                  key={set}
                  onClick={() => setActiveLogSet(set)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex justify-between items-center ${
                    isActive ? "bg-[#1a2332] text-white" : "text-slate-300 hover:bg-[#1a2332]/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tone.fg }}
                    />
                    {set}
                  </span>
                  <span className="text-[10px] text-slate-400 mono">{logSetCounts[set]}</span>
                </button>
              );
            })}
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            {/* Time range row */}
            <div
              className="border-b px-3 py-2 flex items-center gap-2"
              style={{ borderColor: "#23314f" }}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                readOnly
                value="2026-05-13 11:00"
                className="text-xs mono rounded px-2 py-1 outline-none w-[140px]"
                style={{
                  backgroundColor: "#0a1220",
                  color: "#cbd5e1",
                  border: "1px solid #23314f",
                }}
              />
              <span className="text-slate-500 text-xs">→</span>
              <input
                readOnly
                value="2026-05-13 13:00"
                className="text-xs mono rounded px-2 py-1 outline-none w-[140px]"
                style={{
                  backgroundColor: "#0a1220",
                  color: "#cbd5e1",
                  border: "1px solid #23314f",
                }}
              />
              <span className="text-[10px] text-slate-500 ml-auto">UTC · frozen lab time</span>
            </div>

            {/* Search bar */}
            <div className="p-3 flex gap-2 border-b" style={{ borderColor: "#23314f" }}>
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`where(source_ip, ${asset.ip})`}
                  className="w-full pl-7 pr-2 py-1.5 mono text-xs rounded bg-[#0a1220] text-slate-100 border border-[#23314f] focus:border-[#e5402a] outline-none"
                  data-testid="rapid7-query"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setRan(true);
                  }}
                />
              </div>
              <Button
                size="sm"
                onClick={() => setRan(true)}
                className="bg-[#e5402a] hover:bg-[#c8341f] text-white border-0"
                data-testid="rapid7-search"
              >
                Search
              </Button>
            </div>

            {/* Results header */}
            <div
              className="px-3 py-1.5 border-b text-[11px] text-slate-300 flex items-center gap-3"
              style={{ borderColor: "#23314f", backgroundColor: "#0a1220" }}
            >
              <span data-testid="rapid7-result-count">
                Showing <span className="text-white font-semibold">{filtered.length}</span> result
                {filtered.length === 1 ? "" : "s"}
              </span>
              {activeLogSet !== "all" && (
                <span className="text-slate-500">· filter: {activeLogSet}</span>
              )}
              {ran && query.trim() && <span className="text-slate-500">· query: {query}</span>}
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-auto scrollbar-thin">
              {filtered.length === 0 ? (
                <div className="text-xs text-slate-400 p-6 text-center">
                  No results — refine the query or change log set filter.
                </div>
              ) : (
                filtered.map((p, i) => {
                  const isExp = expanded.has(i);
                  const tone = logSetTone(p.set);
                  const ts = p.parsed.timestamp ?? "";
                  return (
                    <div
                      key={i}
                      className="border-b text-xs"
                      style={{ borderColor: "#1a2332" }}
                      data-testid={`rapid7-log-${i}`}
                    >
                      <button
                        onClick={() => toggleExpanded(i)}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[#1a2332]/60"
                      >
                        <span className="mt-0.5 shrink-0 text-slate-400">
                          {isExp ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </span>
                        <span className="mono text-[11px] text-slate-400 w-[160px] shrink-0">
                          {ts}
                        </span>
                        <span
                          className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 mono"
                          style={{
                            backgroundColor: tone.bg,
                            color: tone.fg,
                            border: `1px solid ${tone.border}`,
                          }}
                        >
                          {p.set}
                        </span>
                        <span className="flex-1 truncate text-slate-200 mono">
                          {logSummary(p.parsed, p.line)}
                        </span>
                      </button>
                      {isExp && (
                        <div
                          className="px-3 pb-3 pl-10 pt-1 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[11px] mono"
                          style={{ backgroundColor: "#0a1220" }}
                        >
                          {Object.entries(p.parsed).map(([k, v]) => (
                            <Fragment key={`${i}-${k}`}>
                              <div className="text-slate-400">{k}</div>
                              <div className="text-slate-100 break-all">{v}</div>
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <AssetsView
          asset={asset}
          parsedLogs={parsedLogs}
          riskColour={riskColour}
        />
      )}
    </div>
  );
}

function AssetsView({
  asset,
  parsedLogs,
  riskColour,
}: {
  asset: Rapid7AssetRecord;
  parsedLogs: { line: string; parsed: Record<string, string>; set: LogSet }[];
  riskColour: string;
}) {
  const matchingActivity = useMemo(() => {
    const ip = asset.ip;
    const host = asset.hostname;
    return parsedLogs
      .filter((p) => {
        const hay = p.line.toLowerCase();
        return (
          (ip && hay.includes(ip.toLowerCase())) ||
          (host && hay.includes(host.toLowerCase()))
        );
      })
      .slice(0, 5);
  }, [parsedLogs, asset.ip, asset.hostname]);

  // Simulated CVEs for the device — clearly marked as simulated in the UI
  const fakeCves = useMemo(
    () => [
      {
        id: "CVE-2024-21413",
        title: "Microsoft Outlook Remote Code Execution",
        cvss: 9.8,
        severity: "Critical",
      },
      {
        id: "CVE-2024-30040",
        title: "Windows MSHTML Platform Security Feature Bypass",
        cvss: 8.8,
        severity: "High",
      },
      {
        id: "CVE-2023-23397",
        title: "Microsoft Outlook Elevation of Privilege",
        cvss: 9.1,
        severity: "Critical",
      },
    ],
    [],
  );

  return (
    <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Asset card */}
        <div className="bg-[#0a1220] border border-[#23314f] rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#e5402a]" />
              <span className="text-sm font-semibold text-white mono">{asset.hostname}</span>
            </div>
            <span
              className={`text-[10px] uppercase tracking-widest border rounded px-2 py-0.5 ${riskColour}`}
              data-testid="rapid7-risk"
            >
              Risk: {asset.riskScore}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <dt className="text-slate-400">IP Address</dt>
            <dd className="mono text-slate-100">{asset.ip}</dd>
            <dt className="text-slate-400">OS</dt>
            <dd className="text-slate-100">{asset.os}</dd>
            <dt className="text-slate-400">Last Seen</dt>
            <dd className="mono text-slate-100">{asset.lastSeen}</dd>
            <dt className="text-slate-400">Open Vulns</dt>
            <dd className="mono text-slate-100 flex items-center gap-1">
              {asset.openVulnerabilities > 10 && (
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              )}
              {asset.openVulnerabilities}
            </dd>
          </dl>
          <Button
            size="sm"
            disabled
            variant="outline"
            className="w-full bg-transparent text-slate-400 border-[#23314f] hover:bg-transparent"
            title="InsightVM not connected in this lab"
          >
            View in InsightVM
          </Button>
        </div>

        {/* Recent activity */}
        <div className="bg-[#0a1220] border border-[#23314f] rounded">
          <div className="px-3 py-2 border-b border-[#23314f] text-[10px] uppercase tracking-widest text-slate-400">
            Recent Activity (last 5)
          </div>
          {matchingActivity.length === 0 ? (
            <div className="text-xs text-slate-500 p-3">
              No events mentioning {asset.hostname} or {asset.ip} in the active window.
            </div>
          ) : (
            matchingActivity.map((p, i) => {
              const tone = logSetTone(p.set);
              return (
                <div
                  key={i}
                  className="px-3 py-2 border-b border-[#1a2332] text-xs flex items-start gap-2"
                  data-testid={`rapid7-recent-${i}`}
                >
                  <span className="mono text-[11px] text-slate-400 w-[150px] shrink-0">
                    {p.parsed.timestamp ?? ""}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0 mono"
                    style={{
                      backgroundColor: tone.bg,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {p.set}
                  </span>
                  <span className="flex-1 truncate text-slate-200 mono">
                    {logSummary(p.parsed, p.line)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Open vulnerabilities */}
        <details className="bg-[#0a1220] border border-[#23314f] rounded" open>
          <summary className="px-3 py-2 cursor-pointer text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <CircleAlert className="h-3 w-3 text-amber-400" />
            Open Vulnerabilities
            <span className="ml-auto text-[10px] normal-case text-slate-500">[simulated]</span>
          </summary>
          <div>
            {fakeCves.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 border-t border-[#1a2332] text-xs flex items-center gap-2"
                data-testid={`rapid7-cve-${c.id}`}
              >
                <span className="mono text-slate-100">{c.id}</span>
                <span className="flex-1 truncate text-slate-200">{c.title}</span>
                <span
                  className={`text-[10px] mono rounded px-1.5 py-0.5 border ${
                    c.severity === "Critical"
                      ? "bg-red-900/30 border-red-500/40 text-red-300"
                      : "bg-amber-900/30 border-amber-500/40 text-amber-300"
                  }`}
                >
                  CVSS {c.cvss}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function ComingSoonOverlay({ product }: { product: string }) {
  return (
    <div
      className="flex items-center justify-center h-full bg-[#0f1729] text-slate-300 border-t border-border"
      data-testid="tool-coming-soon"
    >
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
