import { Layout } from "@/components/Layout";
import { MorganBubble } from "@/components/MorganBubble";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import mentor from "@/data/mentor.json";
import alerts from "@/data/alerts.json";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, GraduationCap } from "lucide-react";

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
          <Kpi icon={Database} label="Log Tables" value={8} />
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

        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">What's in the queue today</h2>
          <ul className="text-sm space-y-1.5 text-muted-foreground">
            <li>· 30 incidents across Azure AD, Defender for Endpoint, Defender for Cloud, M365, Azure Firewall, Sysmon</li>
            <li>· One real attack chain hidden inside — find it by following the entities</li>
            <li>· All times relative to the frozen `now` of 2026-05-13T12:00:00Z</li>
          </ul>
        </section>
      </div>
    </Layout>
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
