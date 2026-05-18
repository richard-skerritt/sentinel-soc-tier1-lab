// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, CheckCheck, BookOpen, Sparkles } from "lucide-react";

interface OperatorExplanation {
  what: string;
  analogy: string;
}

const OPERATOR_EXPLANATIONS: Record<string, OperatorExplanation> = {
  where: {
    what: "Filters rows. Only keeps rows where the condition is true. Removes everything else.",
    analogy: "Like the filter button in Excel — you're hiding rows that don't match.",
  },
  project: {
    what: "Picks which columns to show. Hides everything else.",
    analogy:
      "Like hiding columns in a spreadsheet — the data is still there, you just chose what to display.",
  },
  summarize: {
    what: "Groups rows together and calculates totals or counts. Collapses many rows into a summary.",
    analogy:
      "Like a pivot table — instead of 1,000 individual rows, you get one row per group with totals.",
  },
  count: {
    what: "Counts the number of rows.",
    analogy: "Like =COUNT() in Excel.",
  },
  dcount: {
    what: "Counts distinct (unique) values. 'dcount(UserPrincipalName)' tells you how many different users appear.",
    analogy: "Like counting unique values — if the same user appears 50 times, dcount still returns 1.",
  },
  countif: {
    what: "Counts rows only where a condition is true. Like count() but with a filter built in.",
    analogy: "Like =COUNTIF() in Excel.",
  },
  sort: {
    what: "Orders the results by a column. 'sort by FailureCount desc' puts the highest number at the top.",
    analogy: "Like clicking a column header to sort in Excel.",
  },
  take: {
    what: "Returns only the first N rows. 'take 10' gives you the top 10 results.",
    analogy: "Like 'show me just the first page of results'.",
  },
  extend: {
    what: "Adds a new calculated column to each row without removing any existing ones.",
    analogy: "Like adding a formula column in Excel.",
  },
  join: {
    what: "Combines two tables by matching rows on a shared column value.",
    analogy: "Like VLOOKUP in Excel — 'for each row in table A, find the matching row in table B'.",
  },
  ago: {
    what: "A time function meaning 'X time ago from now'. ago(1h) = one hour ago. ago(7d) = seven days ago.",
    analogy: "Like saying 'show me events from the last hour' in plain English.",
  },
  bin: {
    what: "Rounds timestamps into buckets. bin(TimeGenerated, 1h) groups all events in the same hour together.",
    analogy: "Like grouping diary entries by week rather than showing every individual day.",
  },
  distinct: {
    what: "Returns unique rows only — drops duplicates.",
    analogy: "Like 'remove duplicates' in Excel.",
  },
  evaluate: {
    what: "Runs a built-in plugin or function over the table. Less common in day-to-day queries.",
    analogy: "An advanced cell, used when summarize isn't enough.",
  },
};

interface QueryLine {
  raw: string;
  operator: string | null;
  isTable: boolean;
}

function parseQuery(query: string): QueryLine[] {
  const lines = query
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
  return lines.map((raw, i) => {
    if (i === 0 && !raw.startsWith("|")) {
      return { raw, operator: null, isTable: true };
    }
    const m = raw.match(/^\|\s*([A-Za-z_][\w.]*)/);
    return {
      raw,
      operator: m ? m[1].toLowerCase() : null,
      isTable: false,
    };
  });
}

interface QueryExplainerProps {
  query: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueryExplainer({ query, open, onOpenChange }: QueryExplainerProps) {
  const lines = useMemo(() => parseQuery(query || ""), [query]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyLine = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1200);
    } catch {}
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto scrollbar-thin">
        <SheetHeader className="space-y-1.5">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            What this query does
          </SheetTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            One card per line. Each card explains what the operator does, in plain English,
            with an Excel analogy where it helps.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {lines.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Empty query. Run something in Sentinel first.
            </div>
          ) : (
            lines.map((line, i) => {
              const exp =
                line.operator && OPERATOR_EXPLANATIONS[line.operator]
                  ? OPERATOR_EXPLANATIONS[line.operator]
                  : null;
              return (
                <div
                  key={i}
                  className="rounded border border-border bg-card overflow-hidden"
                  data-testid={`query-explainer-line-${i}`}
                >
                  <div className="px-3 py-1.5 bg-muted/30 border-b border-border flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground mono shrink-0">
                      Line {i + 1}
                    </span>
                    <pre className="mono text-xs text-foreground/90 truncate flex-1 m-0">
                      {line.raw}
                    </pre>
                    <button
                      onClick={() => copyLine(i, line.raw)}
                      title="Copy line"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {copiedIdx === i ? (
                        <CheckCheck className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="px-3 py-2.5 text-sm leading-relaxed">
                    {line.isTable ? (
                      <>
                        <span className="font-semibold text-foreground">Table: </span>
                        This is the data source — every row in <code className="mono">{line.raw}</code> is one logged event. The pipe operators below filter and transform it.
                      </>
                    ) : exp ? (
                      <>
                        <div>
                          <span className="font-semibold text-foreground">
                            {line.operator}
                          </span>{" "}
                          — {exp.what}
                        </div>
                        <div className="mt-2 flex items-start gap-2 text-[12px] text-muted-foreground italic">
                          <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                          {exp.analogy}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No explanation cached for this operator — check the KQL Quick Reference
                        for syntax.
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
