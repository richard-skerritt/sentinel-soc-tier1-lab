import { useMemo, useState } from "react";
import { Search, Shield, AlertTriangle } from "lucide-react";
import rapid7Data from "@/data/rapid7_responses.json";
import type { Rapid7AssetRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ResponseEntry {
  logs: string[];
  asset: Rapid7AssetRecord;
}

const responses = rapid7Data as unknown as Record<string, ResponseEntry>;

interface Rapid7PanelProps {
  alertId: string;
  stackAvailable: boolean;
}

export function Rapid7Panel({ alertId, stackAvailable }: Rapid7PanelProps) {
  const entry = responses[alertId];
  const [tab, setTab] = useState<"logs" | "asset">("logs");
  const [query, setQuery] = useState("");
  const [ran, setRan] = useState(false);

  const filtered = useMemo(() => {
    if (!entry) return [];
    if (!ran || !query.trim()) return entry.logs;
    const q = query.toLowerCase();
    return entry.logs.filter((l) => l.toLowerCase().includes(q));
  }, [entry, query, ran]);

  if (!stackAvailable) {
    return <ComingSoonOverlay product="Rapid7 InsightIDR" />;
  }
  if (!entry) {
    return (
      <div className="p-6 text-xs text-muted-foreground bg-[#0f172a] h-full">
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

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-t border-border"
      style={{ backgroundColor: "#0f1729" }}
      data-testid="rapid7-panel"
    >
      <div
        className="flex items-center gap-3 px-3 py-2 border-b"
        style={{ backgroundColor: "#1a2332", borderColor: "#23314f" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-sm" style={{ backgroundColor: "#e5402a" }} />
          <span className="text-sm font-semibold text-white">Rapid7 InsightIDR</span>
        </div>
        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setTab("logs")}
            className={`text-xs px-2.5 py-1 rounded ${
              tab === "logs" ? "bg-[#e5402a] text-white" : "text-slate-300 hover:bg-white/5"
            }`}
            data-testid="rapid7-tab-logs"
          >
            Log Search
          </button>
          <button
            onClick={() => setTab("asset")}
            className={`text-xs px-2.5 py-1 rounded ${
              tab === "asset" ? "bg-[#e5402a] text-white" : "text-slate-300 hover:bg-white/5"
            }`}
            data-testid="rapid7-tab-asset"
          >
            Assets
          </button>
        </div>
      </div>

      {tab === "logs" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 flex gap-2 border-b" style={{ borderColor: "#23314f" }}>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`where(source_ip, ${asset.ip})`}
                className="w-full pl-7 pr-2 py-1.5 mono text-xs rounded bg-[#0a1220] text-slate-100 border border-[#23314f] focus:border-[#e5402a] outline-none"
                data-testid="rapid7-query"
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
          <div className="flex-1 overflow-auto scrollbar-thin p-3 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-slate-400">No results — refine the query.</div>
            ) : (
              filtered.map((line, i) => (
                <pre
                  key={i}
                  className="mono text-[11px] text-slate-200 whitespace-pre-wrap break-all border-b border-[#1a2332] pb-1"
                  data-testid={`rapid7-log-${i}`}
                >
                  {line}
                </pre>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin p-4">
          <div className="max-w-md mx-auto space-y-3 bg-[#0a1220] border border-[#23314f] rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#e5402a]" />
                <span className="text-sm font-semibold text-white">{asset.hostname}</span>
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
        </div>
      )}
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
