import { ReactNode, useState, useEffect, useRef } from "react";
import { User } from "lucide-react";
import { speak } from "@/lib/voice";

export function MorganBubble({
  lines,
  compact = false,
}: {
  lines: (string | ReactNode)[];
  compact?: boolean;
}) {
  const [shown, setShown] = useState(1);
  const spokenIndexes = useRef<Set<number>>(new Set());

  // Speak the first line on mount, then each subsequent line as it appears.
  useEffect(() => {
    const idx = shown - 1;
    if (idx < 0 || idx >= lines.length) return;
    if (spokenIndexes.current.has(idx)) return;
    spokenIndexes.current.add(idx);
    const line = lines[idx];
    if (typeof line === "string") {
      // Fire and forget — voice library handles mute/config and never throws.
      void speak(line);
    }
  }, [shown, lines]);

  // Reset when the lines prop changes (different page/context).
  useEffect(() => {
    spokenIndexes.current = new Set();
    setShown(1);
  }, [lines]);

  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  return (
    <div className="space-y-2" data-testid="morgan-bubble">
      {lines.slice(0, shown).map((l, i) => (
        <div
          key={i}
          className={`flex gap-3 ${compact ? "items-start" : "items-start"}`}
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mt-0.5">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            {i === 0 && (
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                Morgan Reyes · Tier 3
              </div>
            )}
            <div className="bg-card border border-border rounded-md px-3 py-2 text-sm leading-relaxed">
              {l}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
