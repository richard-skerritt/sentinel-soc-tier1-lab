// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import alertsData from "@/data/alerts.json";
import type { Alert } from "@/lib/types";
import { BarChart3, CheckCircle2, AlertTriangle, GraduationCap, Lightbulb, MessageSquare } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

const alerts = alertsData as unknown as Alert[];
const COLORS = ["hsl(0, 80%, 55%)", "hsl(24, 95%, 55%)", "hsl(42, 95%, 60%)", "hsl(199, 80%, 60%)"];

export default function Dashboard() {
  const { data: triages = [] } = useQuery<any[]>({ queryKey: ["/api/triage"] });
  const { data: hints = [] } = useQuery<any[]>({ queryKey: ["/api/triage/hints"] });
  const { data: progress = [] } = useQuery<any[]>({ queryKey: ["/api/tutorial/progress"] });
  const { data: queryHistory = [] } = useQuery<any[]>({ queryKey: ["/api/queryHistory"] });
  const { data: queriesPerAlert = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/queryHistory/perAlert"],
  });

  const totalTriages = triages.length;
  const correct = triages.filter((t: any) => t.correct).length;
  const partial = triages.filter((t: any) => t.partial).length;
  const incorrect = totalTriages - correct - partial;
  const accuracy = totalTriages > 0 ? Math.round((correct / totalTriages) * 100) : 0;

  const totalHints = hints.reduce((s: number, h: any) => s + (h.hintCount ?? 0), 0);

  const queryCount = queryHistory.length;
  const triagedAlerts = Object.keys(queriesPerAlert).length;
  const avgQueries =
    triagedAlerts > 0
      ? (Object.values(queriesPerAlert).reduce((a: number, b: number) => a + b, 0) / triagedAlerts).toFixed(1)
      : "0";

  const sevCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.alertSeverity] = (acc[a.alertSeverity] || 0) + 1;
    return acc;
  }, {});
  const sevData = ["Critical", "High", "Medium", "Low"].map((k) => ({
    name: k,
    value: sevCounts[k] || 0,
  }));

  // per-product
  const productData = Object.entries(
    alerts.reduce<Record<string, number>>((acc, a) => {
      acc[a.product] = (acc[a.product] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> SOC Dashboard
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Shift performance</h1>
        </header>

        <section className="grid grid-cols-6 gap-3">
          <Kpi label="Triages" value={totalTriages} icon={CheckCircle2} />
          <Kpi label="Accuracy" value={`${accuracy}%`} icon={CheckCircle2} accent />
          <Kpi label="Incorrect" value={incorrect} icon={AlertTriangle} bad={incorrect > 0} />
          <Kpi label="Hints used" value={totalHints} icon={Lightbulb} bad={totalHints > 5} />
          <Kpi label="Queries / alert" value={avgQueries} icon={MessageSquare} />
          <Kpi label="Tutorial" value={`${progress.length}/4`} icon={GraduationCap} />
        </section>

        <section className="grid grid-cols-2 gap-4">
          <Card title="Alerts by severity">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {sevData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} stroke="hsl(222, 47%, 9%)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 41%, 12%)",
                    border: "1px solid hsl(222, 25%, 18%)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center text-xs">
              {sevData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="mono">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Alerts by product">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productData} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid stroke="hsl(222, 25%, 16%)" strokeDasharray="3 3" />
                <XAxis type="number" stroke="hsl(215, 16%, 65%)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(215, 16%, 65%)" fontSize={10} width={130} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 41%, 12%)",
                    border: "1px solid hsl(222, 25%, 18%)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(190, 95%, 50%)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <Card title="Triage outcomes">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: "Correct", value: correct, color: "hsl(190, 95%, 50%)" },
                { name: "Partial", value: partial, color: "hsl(42, 95%, 60%)" },
                { name: "Incorrect", value: incorrect, color: "hsl(0, 80%, 55%)" },
              ]}>
                <CartesianGrid stroke="hsl(222, 25%, 16%)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="hsl(215, 16%, 65%)" fontSize={11} />
                <YAxis stroke="hsl(215, 16%, 65%)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 41%, 12%)",
                    border: "1px solid hsl(222, 25%, 18%)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value">
                  {[0, 1, 2].map((i) => (
                    <Cell key={i} fill={["hsl(190, 95%, 50%)", "hsl(42, 95%, 60%)", "hsl(0, 80%, 55%)"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="KQL tutorial progress">
            <ul className="space-y-2 text-sm">
              {["L1", "L2", "L3", "L4"].map((id) => {
                const done = progress.some((p: any) => p.lessonId === id);
                return (
                  <li key={id} className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${done ? "text-primary" : "text-muted-foreground/40"}`} />
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>
                      Lesson {id.slice(1)}
                    </span>
                    {done && <span className="ml-auto text-[10px] text-primary mono">DONE</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      </div>
    </Layout>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  bad,
}: {
  label: string;
  value: any;
  icon: any;
  accent?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-3 w-3 ${accent ? "text-primary" : bad ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <div
        className={`text-lg font-semibold mono ${
          accent ? "text-primary" : bad ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}
