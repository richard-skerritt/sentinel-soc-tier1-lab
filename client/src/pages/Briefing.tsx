import { Layout } from "@/components/Layout";
import { MorganBubble } from "@/components/MorganBubble";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import mentor from "@/data/mentor.json";
import alerts from "@/data/alerts.json";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Database,
  GraduationCap,
  ListChecks,
  Code2,
  Book,
  Search,
  Gavel,
  CheckCircle2,
  FileDown,
} from "lucide-react";

export default function Briefing() {
  const { data: progress = [] } = useQuery<any[]>({ queryKey: ["/api/tutorial/progress"] });
  const completed = progress.length;
  const hasStarted = completed > 0;

  const sevCount = (alerts as unknown as any[]).reduce((acc, a) => {
    acc[a.alertSeverity] = (acc[a.alertSeverity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-2">
            Shift Briefing · 2026-05-13
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome to the desk</h1>
        </header>

        <section className="grid grid-cols-4 gap-3">
          <Kpi icon={AlertTriangle} label="Open Alerts" value={(alerts as unknown as any[]).length} accent />
          <Kpi icon={Activity} label="Critical / High" value={(sevCount.Critical || 0) + (sevCount.High || 0)} />
          <Kpi icon={Database} label="Log Tables" value={10} />
          <Kpi icon={GraduationCap} label="Lessons Done" value={`${completed}/4`} />
        </section>

        <MorganBubble lines={mentor.scripts.welcome_first_login.slice(0, 5)} />

        <section className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold tracking-tight">Get started</h2>
          <div className="flex gap-3">
            {!hasStarted ? (
              <>
                <Link href="/learn">
                  <Button data-testid="cta-start-tutorial" className="gap-2">
                    <GraduationCap className="h-4 w-4" /> Start KQL Tutorial
                  </Button>
                </Link>
                <Link href="/queue">
                  <Button variant="outline" data-testid="cta-open-queue">
                    Skip ahead to Alert Queue
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/queue">
                  <Button data-testid="cta-open-queue" className="gap-2">
                    Open Alert Queue
                  </Button>
                </Link>
                <Link href="/learn">
                  <Button variant="outline" data-testid="cta-continue-tutorial">
                    Continue tutorial ({completed}/4)
                  </Button>
                </Link>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This lab is a realistic desk simulation. Vague alert titles, raw log tables, an embedded KQL
            engine, and a mentor who will not give you the answer. Your job is to dig.
          </p>
        </section>

        <section className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Today's shift — your workflow</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            New to the desk? Work each alert in this order. Don't worry about being fast — Tier 1 is
            about reading carefully and writing notes another analyst can follow.
          </p>
          <ol className="space-y-2">
            <ShiftStep
              n={1}
              icon={AlertTriangle}
              title="Open an alert from the queue"
              body="Pick the top alert. The queue is roughly chronological — older alerts may be linked to newer ones."
            />
            <ShiftStep
              n={2}
              icon={CheckCircle2}
              title="Read the investigation goals"
              body="The left pane lists four checkbox questions. Tick each off as you find the answer in the logs."
            />
            <ShiftStep
              n={3}
              icon={Code2}
              title="Run the starter KQL query in Sentinel"
              body="The Sentinel tab opens with a starter query loaded. Hit Run, then read the result columns — they tell you what to look at next."
            />
            <ShiftStep
              n={4}
              icon={Book}
              title="Use the runbook on the right"
              body="The right column shows a step-by-step playbook for this alert's category. Copy the KQL into the editor and follow the Yes/No branches."
            />
            <ShiftStep
              n={5}
              icon={Search}
              title="Cross-check in Rapid7 InsightIDR and ELK"
              body="The same attack looks different in each tool. Open the InsightIDR and Kibana tabs to corroborate what you saw in Sentinel."
            />
            <ShiftStep
              n={6}
              icon={Gavel}
              title="Submit your triage verdict"
              body="Choose True / False / Benign Positive, tick the response actions you'd take, and leave notes. The mentor scores it."
            />
            <ShiftStep
              n={7}
              icon={FileDown}
              title="Review Morgan's feedback and export the report"
              body="After submit, Morgan shows you what a Tier 3 would have done. Click 'Export Report (.md)' for the SOC-ticket handoff."
            />
          </ol>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">What's in the queue today</h2>
          <ul className="text-sm space-y-1.5 text-muted-foreground">
            <li>· 35 incidents across Azure AD, Defender for Endpoint, Defender for O365, Defender for Cloud, M365, Entra ID, Azure Firewall, Sysmon</li>
            <li>· Two attack chains hidden inside — find them by following the entities</li>
            <li>· All times relative to the frozen `now` of 2026-05-13T12:00:00Z</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}

function ShiftStep({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: any;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 items-start">
      <div className="shrink-0 w-7 h-7 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mono">
        {n}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{body}</p>
      </div>
    </li>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`text-xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
