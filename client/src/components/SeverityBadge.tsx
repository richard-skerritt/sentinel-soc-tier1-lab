// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { ReactNode } from "react";

const STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
  Critical: { bg: "hsl(0, 80%, 55% / 0.15)", fg: "hsl(0, 80%, 70%)", bd: "hsl(0, 80%, 55% / 0.4)" },
  High: { bg: "hsl(24, 95%, 55% / 0.15)", fg: "hsl(24, 95%, 70%)", bd: "hsl(24, 95%, 55% / 0.4)" },
  Medium: { bg: "hsl(42, 95%, 60% / 0.15)", fg: "hsl(42, 95%, 70%)", bd: "hsl(42, 95%, 60% / 0.4)" },
  Low: { bg: "hsl(199, 80%, 60% / 0.15)", fg: "hsl(199, 80%, 75%)", bd: "hsl(199, 80%, 60% / 0.4)" },
};

export function SeverityBadge({ severity, children }: { severity: string; children?: ReactNode }) {
  const s = STYLE[severity] ?? STYLE.Medium;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {children ?? severity}
    </span>
  );
}
