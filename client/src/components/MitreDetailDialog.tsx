import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import mitreData from "@/data/mitre_map.json";
import type { MitreEntry } from "@/lib/types";

const mitre = mitreData as unknown as Record<string, MitreEntry>;

interface MitreDetailDialogProps {
  mitreId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MitreDetailDialog({ mitreId, open, onOpenChange }: MitreDetailDialogProps) {
  const entry = mitreId ? mitre[mitreId] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {entry ? (
              <>
                <span className="mono text-primary text-sm">{entry.techniqueId}</span>
                <span>{entry.technique}</span>
              </>
            ) : (
              <span>MITRE technique not found</span>
            )}
          </DialogTitle>
          {entry && (
            <DialogDescription className="mono text-[11px]">
              Tactic: {entry.tactic} ({entry.tacticId})
            </DialogDescription>
          )}
        </DialogHeader>

        {!entry ? (
          <div className="text-sm text-muted-foreground">
            No detail entry exists for <code className="mono">{mitreId}</code>. Add one to{" "}
            <code className="mono">mitre_map.json</code>.
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <Section title="What the attacker is doing">{entry.whatAttackerDoes}</Section>
            <Section title="Why it matters">{entry.whyItMatters}</Section>
            <div>
              <SectionHeading>Common indicators</SectionHeading>
              <ul className="space-y-1 list-disc pl-5">
                {entry.commonIndicators.map((c, i) => (
                  <li key={i} className="leading-snug">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <CodeSection label="Sentinel (KQL)" code={entry.sentinelKql} />
            <CodeSection label="Rapid7 InsightIDR" code={entry.rapid7Query} />
            <CodeSection label="ELK (Lucene)" code={entry.elkQuery} />
            <Section title="What comes next in the kill chain">{entry.nextMitreStep}</Section>
            <Section title="How this differs from similar techniques">
              {entry.differencesFromBruteForce}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{children}</h4>
  );
}

function CodeSection({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <SectionHeading>{label}</SectionHeading>
      <pre className="mono text-[11px] bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
