import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { PIPELINE_STAGES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [{ data: leads }, { data: services }, { data: followups }] = await Promise.all([
        supabase.from("leads").select("id, stage, service_id, created_at"),
        supabase.from("services").select("id, name"),
        supabase.from("followups").select("id, status, due_date, created_at"),
      ]);
      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = startOfMonth(subMonths(new Date(), 5 - i));
        return { key: format(d, "yyyy-MM"), label: format(d, "MMM"), date: d };
      });
      const monthly = months.map((m) => {
        const next = new Date(m.date); next.setMonth(next.getMonth() + 1);
        const inMonth = leads?.filter((l) => new Date(l.created_at) >= m.date && new Date(l.created_at) < next) ?? [];
        return { month: m.label, leads: inMonth.length, converted: inMonth.filter((l) => l.stage === "converted").length };
      });
      const sMap = new Map(services?.map((s) => [s.id, s.name]));
      const byService = new Map<string, number>();
      leads?.forEach((l) => {
        const n = l.service_id ? sMap.get(l.service_id) ?? "Unassigned" : "Unassigned";
        byService.set(n, (byService.get(n) ?? 0) + 1);
      });
      const serviceData = Array.from(byService.entries()).map(([name, leads]) => ({ name, leads }));
      const stageData = PIPELINE_STAGES.map((s) => ({ stage: s.label, count: leads?.filter((l) => l.stage === s.value).length ?? 0 }));
      const total = leads?.length ?? 0;
      const converted = leads?.filter((l) => l.stage === "converted").length ?? 0;
      const conversionRate = total ? Math.round((converted / total) * 100) : 0;
      const followupStats = {
        pending: followups?.filter((f) => f.status === "pending").length ?? 0,
        completed: followups?.filter((f) => f.status === "completed").length ?? 0,
        overdue: followups?.filter((f) => f.status === "pending" && new Date(f.due_date) < new Date()).length ?? 0,
      };
      return { monthly, serviceData, stageData, total, converted, conversionRate, followupStats };
    },
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance insights across your pipeline.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total leads", value: data?.total ?? 0 },
          { label: "Converted", value: data?.converted ?? 0 },
          { label: "Conversion rate", value: `${data?.conversionRate ?? 0}%` },
          { label: "Overdue follow-ups", value: data?.followupStats.overdue ?? 0 },
        ].map((c) => (
          <Card key={c.label} className="shadow-soft"><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{c.label}</p>
            <p className="text-3xl font-semibold mt-1.5">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Monthly lead growth</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthly ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff7a59" stopOpacity={0.4} /><stop offset="95%" stopColor="#ff7a59" stopOpacity={0} /></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="leads" stroke="#ff7a59" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="converted" stroke="#22c55e" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Leads by service</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.serviceData ?? []} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#33475b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-base">Pipeline stages</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.stageData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#ff7a59" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
