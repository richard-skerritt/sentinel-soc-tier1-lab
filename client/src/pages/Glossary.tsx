import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import glossaryData from "@/data/glossary.json";
import { Search, BookMarked, Lightbulb } from "lucide-react";
import type { GlossaryEntry } from "@/components/JargonTip";

const data = glossaryData as unknown as Record<string, GlossaryEntry>;

type TagFilter = "All" | "Tools" | "Attack Types" | "Verdicts" | "Concepts";

const TAGS: TagFilter[] = ["All", "Tools", "Attack Types", "Verdicts", "Concepts"];

export default function Glossary() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<TagFilter>("All");

  const entries = useMemo(() => {
    const all = Object.entries(data).map(([slug, e]) => ({ slug, ...e }));
    const filtered = all.filter((e) => {
      if (tag !== "All" && !(e.tags ?? []).includes(tag)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${e.term} ${e.full} ${e.definition} ${e.why_it_matters} ${e.analogy ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => a.term.localeCompare(b.term));
  }, [query, tag]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
            <BookMarked className="h-3 w-3" /> Glossary
          </div>
          <h1 className="text-xl font-semibold tracking-tight">SOC Analyst glossary</h1>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Every piece of jargon that appears in this lab, explained. Hover any{" "}
            <span className="underline decoration-dotted decoration-muted-foreground/60 underline-offset-[3px]">
              underlined term
            </span>{" "}
            elsewhere in the app for a quick tooltip — or click it for the full definition.
          </p>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search glossary — try 'spray', 'KQL', 'TOR'..."
              className="w-full pl-8 pr-2 py-2 text-sm rounded border border-border bg-background outline-none focus:border-primary/60"
              data-testid="glossary-search"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                data-testid={`glossary-tag-${t.replace(/\s+/g, "-")}`}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  tag === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {entries.length} {entries.length === 1 ? "term" : "terms"}
            {query.trim() && ` matching "${query.trim()}"`}
          </div>
        </div>

        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded border border-border bg-card p-6 text-sm text-muted-foreground text-center">
              No matching terms. Try a different filter or search keyword.
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.slug}
                className="bg-card border border-border rounded-lg p-4 space-y-3"
                data-testid={`glossary-entry-${e.slug}`}
                id={`gloss-${e.slug}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-base font-semibold">{e.term}</h2>
                  <span className="text-[11px] mono text-muted-foreground">{e.full}</span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {(e.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="text-[9px] uppercase tracking-wider mono rounded border border-border bg-muted/40 text-muted-foreground px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{e.definition}</p>
                <div className="rounded border-l-4 border-l-primary/60 bg-primary/5 p-2.5 space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                    Why it matters
                  </div>
                  <p className="text-sm leading-relaxed">{e.why_it_matters}</p>
                </div>
                {e.analogy && (
                  <div className="rounded border-l-4 border-l-yellow-500 bg-yellow-900/10 p-2.5 flex items-start gap-2">
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400" />
                    <p className="text-[13px] italic text-yellow-100/90 leading-relaxed">
                      {e.analogy}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
