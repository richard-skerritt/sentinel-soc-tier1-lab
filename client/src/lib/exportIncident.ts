// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import type { Alert } from "@/lib/types";

export interface TriageSnapshot {
  verdict: string;
  actions: string[];
  notes: string;
  correct?: number;
  partial?: number;
  submittedAt?: number;
}

export interface QueryHistoryEntry {
  query: string;
  executedAt: string | number;
  resultRows: number;
}

export interface ExportOptions {
  analystName?: string;
  escalated?: boolean;
  escalationNotes?: string;
}

function fmtTime(value: number | string | undefined): string {
  if (value === undefined || value === null) return new Date().toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return value;
}

function bulletList(items: string[]): string {
  if (!items.length) return "  (none)";
  return items.map((s) => `  - ${s}`).join("\n");
}

export function exportIncident(
  alert: Alert,
  triage: TriageSnapshot,
  queryHistory: QueryHistoryEntry[],
  opts: ExportOptions = {},
): string {
  const analyst = opts.analystName?.trim() || "SOC Analyst T1";
  const submittedAt = fmtTime(triage.submittedAt);
  const verdictBadge =
    triage.verdict || "Pending"; // True Positive / False Positive / Benign Positive
  const confidence =
    triage.correct === 1 ? 95 : triage.partial === 1 ? 70 : triage.correct === 0 ? 50 : 80;
  const escalated =
    opts.escalated ?? (triage.verdict?.toLowerCase().includes("true positive") ?? false);

  const queryLines =
    queryHistory.length === 0
      ? "  (no queries recorded)"
      : queryHistory
          .map(
            (q, i) =>
              `  ${i + 1}. [${fmtTime(q.executedAt)}] (${q.resultRows} rows)\n     ${q.query
                .replace(/\n/g, "\n     ")
                .trim()}`,
          )
          .join("\n");

  return [
    "INCIDENT REPORT",
    "===============",
    `Incident ID:   INC-${alert.id}-${new Date(submittedAt).getTime()}`,
    `Analyst:       ${analyst}`,
    `Date/Time:     ${submittedAt}`,
    `Severity:      ${alert.alertSeverity}`,
    `Status:        ${verdictBadge}`,
    "",
    "ALERT DETAILS",
    "-------------",
    `Rule Name:     ${alert.ruleName}`,
    `Product:       ${alert.product}`,
    `MITRE:         ${alert.mitre.join(", ")}`,
    `Category:      ${alert.category}`,
    `Entities:      ${Object.entries(alert.entities)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    "",
    "INVESTIGATION SUMMARY",
    "---------------------",
    triage.notes?.trim() ? triage.notes.trim() : "(no analyst notes provided)",
    "",
    "QUERIES EXECUTED",
    "----------------",
    queryLines,
    "",
    "VERDICT",
    "-------",
    `${verdictBadge}`,
    `Confidence:    ${confidence}%`,
    "",
    "RESPONSE ACTIONS",
    "----------------",
    bulletList(triage.actions ?? []),
    "",
    "ESCALATION",
    "----------",
    escalated
      ? `Escalated to Tier 2.${opts.escalationNotes ? `\n${opts.escalationNotes}` : ""}`
      : "Resolved at Tier 1 — no escalation required",
    "",
  ].join("\n");
}

export function downloadIncidentReport(alert: Alert, markdown: string): void {
  const filename = `INC-${alert.id}-${new Date().toISOString().slice(0, 10)}.md`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
