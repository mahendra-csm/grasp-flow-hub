import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, CheckCircle2, Clock, ArrowUpRight, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildDashboardRecommendations,
  type DashboardActivityRow,
  type DashboardFollowupRow,
  type DashboardLeadRow,
  type DashboardRecommendations,
} from "@/lib/dashboard-recommendations";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type DashboardStats = {
  total: number;
  converted: number;
  active: number;
  pendingFollowups: number;
  overdue: number;
  overdueFollowups: number;
  serviceData: Array<{ name: string; value: number }>;
  stageData: Array<{ stage: string; count: number }>;
  activities: DashboardActivityRow[];
  followups: DashboardFollowupRow[];
  leads: DashboardLeadRow[];
};

function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [{ data: leads }, { data: services }, { data: followups }, { data: activities }] = await Promise.all([
        supabase.from("leads").select("id, full_name, stage, priority, service_id, source, created_at, updated_at, follow_up_date, notes, email, phone, whatsapp, services(name)"),
        supabase.from("services").select("id, name, color"),
        supabase.from("followups").select("lead_id, due_date, status, completed_at, notes"),
        supabase.from("activities").select("lead_id, type, description, created_at").order("created_at", { ascending: false }),
      ]);
      const leadRows = (leads ?? []) as DashboardLeadRow[];
      const total = leads?.length ?? 0;
      const converted = leadRows.filter((l) => l.stage === "converted").length;
      const active = leadRows.filter((l) => !["converted", "closed", "lost"].includes(l.stage)).length;
      const now = new Date();
      const pendingFollowups = followups?.filter((f) => f.status === "pending" && new Date(f.due_date) >= now).length ?? 0;
      const overdue = followups?.filter((f) => f.status === "pending" && new Date(f.due_date) < now).length ?? 0;

      const serviceMap = new Map(services?.map((s) => [s.id, s]) ?? []);
      const byService = new Map<string, number>();
      leadRows.forEach((l) => {
        const name = l.service_id ? serviceMap.get(l.service_id)?.name ?? "Unassigned" : "Unassigned";
        byService.set(name, (byService.get(name) ?? 0) + 1);
      });
      const serviceData = Array.from(byService.entries()).map(([name, value]) => ({ name, value }));

      const stageData = PIPELINE_STAGES.map((s) => ({
        stage: s.label,
        count: leadRows.filter((l) => l.stage === s.value).length,
      }));

      return {
        total,
        converted,
        active,
        pendingFollowups,
        overdue,
        overdueFollowups: overdue,
        serviceData,
        stageData,
        activities: (activities ?? []) as DashboardActivityRow[],
        followups: (followups ?? []) as DashboardFollowupRow[],
        leads: leadRows,
      };
    },
  });

  const recommendations = useMemo<DashboardRecommendations | null>(() => {
    if (!stats) return null;
    return buildDashboardRecommendations(stats);
  }, [stats]);

  const STALE_DAYS = 7;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const staleLeads = useMemo(() => {
    if (!stats) return [];
    const now = Date.now();
    return stats.leads
      .filter((l) => !["converted", "closed", "lost"].includes(l.stage))
      .map((l) => {
        const last = new Date(l.updated_at).getTime();
        const days = Math.floor((now - last) / DAY_MS);
        return { lead: l, days };
      })
      .filter(({ days }) => days >= STALE_DAYS)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
  }, [stats]);

  const cards = [
    { label: "Total Leads", value: stats?.total ?? 0, icon: Users, hint: "All time", tone: "text-info" },
    { label: "Active Leads", value: stats?.active ?? 0, icon: TrendingUp, hint: "In pipeline", tone: "text-primary" },
    { label: "Converted", value: stats?.converted ?? 0, icon: CheckCircle2, hint: "Won deals", tone: "text-success" },
    { label: "Follow-ups", value: stats?.pendingFollowups ?? 0, icon: Clock, hint: `${stats?.overdue ?? 0} overdue`, tone: "text-warning-foreground" },
  ];

  const COLORS = ["#ff7a59", "#33475b", "#22c55e", "#f59e0b", "#6366f1", "#06b6d4", "#ec4899", "#84cc16"];

  if (isLoading) {
    return <div className="max-w-7xl mx-auto text-sm text-muted-foreground py-8">Loading dashboard…</div>;
  }

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

      <Card className="shadow-soft border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Priority lead recommendations</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ranked from the strongest follow-up opportunity to the least urgent open lead. Each item shows why it matters and what to do next.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!recommendations?.topLeads.length ? (
            <EmptyState message="Add open leads and follow-ups to generate the priority list." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{recommendations.headline}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{recommendations.summary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recommendations.focusAreas.map((item) => (
                    <Badge key={item} variant="secondary" className="rounded-full">
                      {item}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-2 rounded-2xl border bg-background/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next actions</p>
                  <div className="space-y-3">
                    {recommendations.nextActions.map((action) => (
                      <div key={action.title} className="rounded-xl border bg-card p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-5">{action.title}</p>
                          <Badge variant={action.priority === "high" ? "destructive" : action.priority === "medium" ? "outline" : "secondary"} className="shrink-0 capitalize text-[10px]">
                            {action.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-5">{action.reason}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5">{action.timing}</span>
                          {action.lead ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{action.lead}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks to watch</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {recommendations.risks.map((risk) => (
                      <li key={risk} className="flex gap-2">
                        <span className="mt-2 size-1.5 rounded-full bg-warning shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border bg-card/70">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hot leads</p>
                      <p className="text-xs text-muted-foreground">Fastest wins to work first</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{recommendations.hotLeads.length} hot</Badge>
                  </div>

                  <div className="p-4 grid gap-3 sm:grid-cols-1">
                    {recommendations.hotLeads.length ? recommendations.hotLeads.map((lead) => (
                      <div key={lead.id} className="rounded-xl border bg-background/80 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link to="/leads/$id" params={{ id: lead.id }} className="font-medium text-sm hover:underline truncate block">
                              {lead.name}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">{lead.stage.replace(/_/g, " ")} • {lead.priority}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{lead.score}/10</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-5 line-clamp-2">{lead.reason}</p>
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <Badge variant="outline" className="capitalize">Service: {lead.servicePriority}</Badge>
                          <Badge variant="outline" className="capitalize">Source: {lead.sourcePriority}</Badge>
                          <Badge variant="secondary">Stale {lead.staleDays}d</Badge>
                        </div>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">No hot leads just yet.</div>}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card/70">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top leads to follow</p>
                      <p className="text-xs text-muted-foreground">{Math.min(15, recommendations.topLeads.length)} leads ranked by urgency and follow-up pressure</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Top {Math.min(15, recommendations.topLeads.length)}</Badge>
                  </div>

                  <ScrollArea className="h-[420px]">
                    <div className="divide-y">
                      {recommendations.topLeads.map((lead, index) => (
                        <div key={lead.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="secondary" className="rounded-full text-[10px] shrink-0">#{index + 1}</Badge>
                                <Link to="/leads/$id" params={{ id: lead.id }} className="font-medium text-sm hover:underline truncate">
                                  {lead.name}
                                </Link>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[10px]">
                                <Badge variant="outline" className="capitalize">{lead.stage.replace(/_/g, " ")}</Badge>
                                <Badge variant={lead.priority === "urgent" ? "destructive" : lead.priority === "high" ? "outline" : "secondary"} className="capitalize">
                                  {lead.priority}
                                </Badge>
                                {lead.service ? <Badge variant="secondary">{lead.service}</Badge> : <Badge variant="secondary">Unassigned service</Badge>}
                                {lead.source ? <Badge variant="outline">Source: {lead.source}</Badge> : null}
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[10px]">Score {lead.score}/10</Badge>
                          </div>

                          <p className="text-xs text-muted-foreground leading-5">{lead.reason}</p>

                          <div className="grid gap-2 sm:grid-cols-2 text-xs">
                            <div className="rounded-lg bg-muted/60 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next step</p>
                              <p className="mt-0.5 leading-5">{lead.nextStep}</p>
                            </div>
                            <div className="rounded-lg bg-muted/60 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Timing</p>
                              <p className="mt-0.5 leading-5">{lead.timing}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>Channel: {lead.channel}</span>
                            <span>•</span>
                            <span>Last touched {formatDistanceToNow(new Date(lead.lastTouchedAt), { addSuffix: true })}</span>
                            <span>•</span>
                            <span>Stale for {lead.staleDays} day{lead.staleDays === 1 ? "" : "s"}</span>
                            {lead.followUpDueAt ? <><span>•</span><span>Follow-up {formatDistanceToNow(new Date(lead.followUpDueAt), { addSuffix: true })}</span></> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card className={`shadow-soft ${staleLeads.length ? "border-warning/40 bg-warning/5" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`size-4 ${staleLeads.length ? "text-warning-foreground" : "text-muted-foreground"}`} />
              Stale leads
              {staleLeads.length > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
                  {staleLeads.length}
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">No contact in {STALE_DAYS}+ days</p>
          </div>
        </CardHeader>
        <CardContent>
          {staleLeads.length ? (
            <div className="space-y-2">
              {staleLeads.map(({ lead, days }) => {
                const stage = PIPELINE_STAGES.find((s) => s.value === lead.stage);
                return (
                  <Link
                    key={lead.id}
                    to="/leads/$id"
                    params={{ id: lead.id }}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 hover:bg-background transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Last touched {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
                        {lead.source ? <> • {lead.source}</> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {stage && (
                        <Badge variant="outline" className={`${stage.color} hidden sm:inline-flex`}>
                          {stage.label}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          days >= 14
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-warning/10 text-warning-foreground border-warning/30"
                        }
                      >
                        {days}d
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nothing stale — every active lead has been touched recently.
            </p>
          )}
        </CardContent>
      </Card>

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
