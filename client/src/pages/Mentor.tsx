// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { Layout } from "@/components/Layout";
import { MorganBubble } from "@/components/MorganBubble";
import mentor from "@/data/mentor.json";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const intents = [
  { id: "lost_on_alert", label: "I don't know where to start with this alert" },
  { id: "write_kql_for_x", label: "Help me write a KQL query for X" },
  { id: "explain_query", label: "Explain this query…" },
  { id: "what_does_column_mean", label: "What does this column mean?" },
];

export default function Mentor() {
  const [thread, setThread] = useState<
    { who: "user" | "morgan"; lines: string[] }[]
  >([
    { who: "morgan", lines: ["Hey - what do you need? Pick one, or just type." ] },
  ]);
  const [draft, setDraft] = useState("");

  const ask = (intentId: string, label: string) => {
    const reply = (mentor.scripts.mentor_starter_intents as any)[intentId] as string;
    setThread((t) => [
      ...t,
      { who: "user", lines: [label] },
      { who: "morgan", lines: [reply] },
    ]);
  };

  const send = () => {
    if (!draft.trim()) return;
    // Naive routing — keyword match
    const lower = draft.toLowerCase();
    let reply = "Tell me what table you're looking at and what you're trying to find. I'll write the first pipe with you.";
    if (lower.includes("kql") || lower.includes("query")) reply = (mentor.scripts.mentor_starter_intents as any).write_kql_for_x;
    else if (lower.includes("column") || lower.includes("field")) reply = (mentor.scripts.mentor_starter_intents as any).what_does_column_mean;
    else if (lower.includes("explain")) reply = (mentor.scripts.mentor_starter_intents as any).explain_query;
    else if (lower.includes("lost") || lower.includes("stuck") || lower.includes("where to start")) reply = (mentor.scripts.mentor_starter_intents as any).lost_on_alert;
    setThread((t) => [...t, { who: "user", lines: [draft] }, { who: "morgan", lines: [reply] }]);
    setDraft("");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3" /> Mentor Chat
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Morgan Reyes</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tier 3 / shift lead. {mentor.persona.background}
          </p>
        </header>

        <div className="space-y-4">
          {thread.map((m, i) =>
            m.who === "morgan" ? (
              <MorganBubble key={i} lines={m.lines} compact />
            ) : (
              <div key={i} className="flex justify-end">
                <div className="bg-primary/10 border border-primary/30 rounded px-3 py-2 text-sm max-w-md">
                  {m.lines[0]}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {intents.map((i) => (
            <button
              key={i.id}
              onClick={() => ask(i.id, i.label)}
              data-testid={`intent-${i.id}`}
              className="text-xs px-2.5 py-1.5 rounded border border-border bg-card hover:border-primary/40"
            >
              {i.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Morgan anything…"
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm"
            data-testid="mentor-input"
          />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
    </Layout>
  );
}
