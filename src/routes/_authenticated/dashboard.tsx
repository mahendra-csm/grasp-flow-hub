import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, CheckCircle2, Clock, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [{ data: leads }, { data: services }, { data: followups }, { data: activities }] = await Promise.all([
        supabase.from("leads").select("id, stage, service_id, created_at, full_name"),
        supabase.from("services").select("id, name, color"),
        supabase.from("followups").select("id, due_date, status"),
        supabase.from("activities").select("id, type, description, created_at, lead_id, leads(full_name)").order("created_at", { ascending: false }).limit(8),
      ]);
      const total = leads?.length ?? 0;
      const converted = leads?.filter((l) => l.stage === "converted").length ?? 0;
      const active = leads?.filter((l) => !["converted", "closed", "lost"].includes(l.stage)).length ?? 0;
      const now = new Date();
      const pendingFollowups = followups?.filter((f) => f.status === "pending" && new Date(f.due_date) >= now).length ?? 0;
      const overdue = followups?.filter((f) => f.status === "pending" && new Date(f.due_date) < now).length ?? 0;

      const serviceMap = new Map(services?.map((s) => [s.id, s]) ?? []);
      const byService = new Map<string, number>();
      leads?.forEach((l) => {
        const name = l.service_id ? serviceMap.get(l.service_id)?.name ?? "Unassigned" : "Unassigned";
        byService.set(name, (byService.get(name) ?? 0) + 1);
      });
      const serviceData = Array.from(byService.entries()).map(([name, value]) => ({ name, value }));

      const stageData = PIPELINE_STAGES.map((s) => ({
        stage: s.label,
        count: leads?.filter((l) => l.stage === s.value).length ?? 0,
      }));

      return { total, converted, active, pendingFollowups, overdue, serviceData, stageData, activities: activities ?? [] };
    },
  });

  const cards = [
    { label: "Total Leads", value: stats?.total ?? 0, icon: Users, hint: "All time", tone: "text-info" },
    { label: "Active Leads", value: stats?.active ?? 0, icon: TrendingUp, hint: "In pipeline", tone: "text-primary" },
    { label: "Converted", value: stats?.converted ?? 0, icon: CheckCircle2, hint: "Won deals", tone: "text-success" },
    { label: "Follow-ups", value: stats?.pendingFollowups ?? 0, icon: Clock, hint: `${stats?.overdue ?? 0} overdue`, tone: "text-warning-foreground" },
  ];

  const COLORS = ["#ff7a59", "#33475b", "#22c55e", "#f59e0b", "#6366f1", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your CRM activity.</p>
        </div>
        <Link to="/leads" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          View all leads <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-soft">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="text-3xl font-semibold mt-1.5">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
                </div>
                <div className={`size-10 rounded-lg bg-muted grid place-items-center ${c.tone}`}>
                  <c.icon className="size-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader><CardTitle className="text-base">Pipeline distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.stageData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-popover)" }} />
                  <Bar dataKey="count" fill="#ff7a59" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Service mix</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {stats?.serviceData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.serviceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {stats.serviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No leads yet." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent>
          {stats?.activities.length ? (
            <div className="space-y-3">
              {stats.activities.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate"><span className="font-medium">{a.leads?.full_name ?? "Lead"}</span> — {a.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No activity yet. Add your first lead to get started." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full grid place-items-center text-sm text-muted-foreground py-8">
      {message}
    </div>
  );
}
