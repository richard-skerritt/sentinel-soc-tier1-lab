// Client-side log-table cache. Fetches each table from /api/logs/:tableName on demand
// and caches it in-memory.

import { runQuery as engineRun } from "./kql";

const tableCache: Record<string, any[]> = {};
const inflight: Record<string, Promise<any[]>> = {};

const ALL_TABLES = [
  "SigninLogs",
  "DeviceProcessEvents",
  "DeviceNetworkEvents",
  "OfficeActivity",
  "AzureActivity",
  "AzureFirewallNetworkRule",
  "SysmonEvent",
  "ThreatIntelligenceIndicator",
];

import { apiRequest } from "./queryClient";

async function fetchTable(name: string): Promise<any[]> {
  if (name in tableCache) return tableCache[name];
  if (name in inflight) return inflight[name];
  const p = apiRequest("GET", `/api/logs/${name}`)
    .then((r: Response) => r.json())
    .then((d: any[]) => {
      tableCache[name] = d;
      delete inflight[name];
      return d;
    });
  inflight[name] = p;
  return p;
}

export async function loadAllTables(): Promise<Record<string, any[]>> {
  await Promise.all(ALL_TABLES.map((t) => fetchTable(t).catch(() => [])));
  return tableCache;
}

export async function runQuery(text: string, opts?: { alertId?: string }) {
  // Try to detect the first table-name token; pre-fetch ALL tables anyway since queries
  // can reference any table (pivot menus, joins).
  await loadAllTables();
  const result = engineRun(text, tableCache);
  // Log to history (best effort)
  try {
    await apiRequest("POST", "/api/queryHistory", {
      alertId: opts?.alertId ?? null,
      query: text,
      resultRows: result.totalRows,
    });
  } catch {}
  return result;
}

export function getCachedTables(): Record<string, any[]> {
  return tableCache;
}
