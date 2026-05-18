// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import glossary from "@/data/glossary.json";

export interface GlossaryEntry {
  term: string;
  full: string;
  definition: string;
  why_it_matters: string;
  analogy: string | null;
  tags?: string[];
}

const data = glossary as unknown as Record<string, GlossaryEntry>;

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return data[slug];
}

interface JargonTipProps {
  /** The text to display. If `children` is provided, that's used instead. */
  term: string;
  /** Key into glossary.json — defaults to `term`. */
  slug?: string;
  /** Optional wrap: render children with the underline/tooltip behaviour. */
  children?: ReactNode;
  /** Set true if the term is sitting on a coloured/dark background — uses a lighter underline. */
  inverse?: boolean;
}

/**
 * Wraps a technical word with hover-tooltip (one-liner) and click-popover
 * (full definition). Designed to be sprinkled liberally — every piece of
 * jargon in the UI should be explainable inline.
 */
export function JargonTip({ term, slug, children, inverse }: JargonTipProps) {
  const key = slug ?? term;
  const entry = data[key];

  // Unknown slug — render plain text so the UI still works even before we
  // add the glossary entry. Surfaces only as a missing tooltip.
  if (!entry) {
    return <>{children ?? term}</>;
  }

  const underline = inverse
    ? "underline decoration-dotted decoration-current/60 underline-offset-[3px]"
    : "underline decoration-dotted decoration-muted-foreground/60 underline-offset-[3px]";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline ${underline} cursor-help hover:decoration-primary/80 transition-colors`}
              data-testid={`jargon-${key}`}
              aria-label={`Define: ${entry.term}`}
            >
              {children ?? term}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          <span className="font-semibold">{entry.term}</span>
          <span className="mx-1.5 text-muted-foreground">—</span>
          <span className="text-muted-foreground">{entry.definition}</span>
          <span className="block text-[10px] text-muted-foreground mt-1">
            Click to see full definition
          </span>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 space-y-2.5">
        <div className="space-y-0.5">
          <div className="text-base font-semibold leading-tight">{entry.term}</div>
          <div className="text-[11px] text-muted-foreground mono">{entry.full}</div>
        </div>
        <div className="text-sm leading-relaxed">{entry.definition}</div>
        <div className="rounded border-l-4 border-l-primary/60 bg-primary/5 p-2.5 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Why it matters
          </div>
          <div className="text-sm leading-relaxed">{entry.why_it_matters}</div>
        </div>
        {entry.analogy && (
          <div className="rounded border-l-4 border-l-yellow-500 bg-yellow-900/10 p-2.5 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400" />
            <div className="text-[13px] italic text-yellow-100/90 leading-relaxed">
              {entry.analogy}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JargonText — auto-wrap known glossary terms inside an arbitrary string.
// Use this for description text, runbook step action labels, goals etc.
// ─────────────────────────────────────────────────────────────────────────────

/** Slugs we feel safe auto-matching inside flowing text. Curated to avoid
 *  false hits (e.g. we skip "IP" as a substring of "IPAddress"). */
const AUTOTAG_SLUGS: readonly string[] = [
  // Multi-word entries first so "True Positive" matches before "Positive".
  "Password Spray",
  "Lateral Movement",
  "True Positive",
  "False Positive",
  "Benign Positive",
  "Azure AD",
  "Tier 1",
  "Tier 2",
  "MITRE ATT&CK",
  "ResultType",
  // Single-word / acronyms.
  "MITRE",
  "Sentinel",
  "Rapid7",
  "Kibana",
  "ELK",
  "KQL",
  "LEQL",
  "SIEM",
  "EDR",
  "SOC",
  "IOC",
  "TTP",
  "MFA",
  "UPN",
  "ECS",
  "CVSS",
  "SHA256",
  "TOR",
  "C2",
];

const SLUG_ALIAS: Record<string, string> = {
  Kibana: "ELK",
  "MITRE ATT&CK": "MITRE",
};

const AUTOTAG_RE = (() => {
  // Sort by length desc so longer matches win, escape regex metachars.
  const sorted = [...AUTOTAG_SLUGS].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Use word-boundary-ish anchors that work for terms containing & and digits.
  return new RegExp(`(?<![\\w])(${escaped.join("|")})(?![\\w])`, "gi");
})();

interface JargonTextProps {
  text: string;
  /** Render as <p> instead of inline <span>. Defaults to inline. */
  asBlock?: boolean;
  className?: string;
  /** Set true if the surrounding background is dark/coloured. */
  inverse?: boolean;
}

/**
 * Splits a string at every glossary-term occurrence and wraps each in
 * <JargonTip>. Plain text passes through unchanged.
 */
export function JargonText({ text, asBlock, className, inverse }: JargonTextProps) {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  // Reset regex state — AUTOTAG_RE is global and shared across calls.
  AUTOTAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AUTOTAG_RE.exec(text)) !== null) {
    const matchText = m[0];
    const start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const canonical =
      AUTOTAG_SLUGS.find((s) => s.toLowerCase() === matchText.toLowerCase()) ??
      matchText;
    const slug = SLUG_ALIAS[canonical] ?? canonical;
    parts.push(
      <JargonTip key={`${start}-${slug}`} slug={slug} term={matchText} inverse={inverse} />,
    );
    lastIndex = start + matchText.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  const Tag = asBlock ? "p" : "span";
  return <Tag className={className}>{parts}</Tag>;
}

