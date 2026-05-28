import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Eye,
  Download,
  Upload,
  Mic,
  SlidersHorizontal,
  CalendarDays,
  Flame,
  SortDesc,
  Funnel,
} from "lucide-react";
import { LeadFormSheet } from "@/components/lead-form-sheet";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { VoiceLeadDialog } from "@/components/voice-lead-dialog";
import { scoreLead } from "@/lib/scoring";
import { PIPELINE_STAGES, PRIORITIES } from "@/lib/constants";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";

type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];

type FilterLead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  source: string | null;
  priority: Database["public"]["Enums"]["lead_priority"];
  stage: PipelineStage;
  follow_up_date: string | null;
  service_id: string | null;
  services: { name: string; color: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/leads/")({
  component: LeadsPage,
});

const PAGE_SIZE = 20;
const DAYS_PRESETS = [1, 3, 5, 7, 9] as const;
const PRIORITY_OPTIONS = PRIORITIES;
const FOLLOW_UP_PRESETS = [
  { value: "all", label: "All follow-ups" },
  { value: "none", label: "No follow-up" },
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "soon", label: "Due soon" },
] as const;
const ACTIVITY_PRESETS = [
  { value: "all", label: "All activity" },
  { value: "today", label: "Updated today" },
  { value: "3", label: "Active in 3 days" },
  { value: "7", label: "Active in 7 days" },
  { value: "14", label: "Stale over 14 days" },
] as const;
const SCORE_PRESETS = [
  { value: "all", label: "All scores" },
  { value: "high", label: "High score" },
  { value: "medium", label: "Medium score" },
  { value: "low", label: "Low score" },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(a: Date, b: Date) {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

function getScoreBand(score: number) {
  if (score >= 8) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function getLeadScore(lead: FilterLead) {
  return scoreLead({
    stage: lead.stage,
    priority: lead.priority,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    lastActivityAt: lead.updated_at,
  });
}

function matchesFollowUp(filter: string, lead: FilterLead) {
  if (filter === "all") return true;
  const due = lead.follow_up_date ? new Date(lead.follow_up_date) : null;
  if (filter === "none") return !due;
  if (!due) return false;

  const delta = diffDays(due, new Date());
  if (filter === "today") return delta === 0;
  if (filter === "overdue") return delta < 0;
  if (filter === "soon") return delta >= 1 && delta <= 7;
  return true;
}

function matchesActivity(filter: string, lead: FilterLead) {
  if (filter === "all") return true;
  const daysAgo = diffDays(new Date(), new Date(lead.updated_at));
  if (filter === "today") return daysAgo === 0;
  if (filter === "3") return daysAgo <= 3;
  if (filter === "7") return daysAgo <= 7;
  if (filter === "14") return daysAgo > 14;
  return true;
}

function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [daysFilter, setDaysFilter] = useState<number | "all">("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const onNew = () => { setEditing(null); setSheetOpen(true); };
    const onImport = () => setImportOpen(true);
    const onVoice = () => setVoiceOpen(true);
    window.addEventListener("crm:new-lead", onNew);
    window.addEventListener("crm:import-leads", onImport);
    window.addEventListener("crm:voice-lead", onVoice);
    return () => {
      window.removeEventListener("crm:new-lead", onNew);
      window.removeEventListener("crm:import-leads", onImport);
      window.removeEventListener("crm:voice-lead", onVoice);
    };
  }, []);

  const { data: services } = useQuery({
    queryKey: ["services-active"],
    queryFn: async () =>
      (await supabase.from("services").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("leads")
        .select("*, services(name, color)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { rows: (data ?? []) as FilterLead[], count: count ?? 0 };
    },
  });

  const sourceOptions = useMemo(() => {
    const values = new Set<string>();
    (data?.rows ?? []).forEach((lead) => {
      if (lead.source) values.add(lead.source);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredRows = useMemo(() => {
    const rows = (data?.rows ?? []).filter((lead) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = [lead.full_name, lead.email, lead.phone, lead.whatsapp, lead.city, lead.country, lead.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (serviceFilter !== "all" && lead.service_id !== serviceFilter) return false;
      if (sourceFilter !== "all" && (lead.source ?? "") !== sourceFilter) return false;

      if (selectedPriorities.length && !selectedPriorities.includes(lead.priority)) return false;
      if (urgentOnly && !["high", "urgent"].includes(lead.priority)) return false;

      if (daysFilter !== "all") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - Number(daysFilter));
        if (new Date(lead.created_at) < cutoff) return false;
      }

      if (!matchesFollowUp(followUpFilter, lead)) return false;
      if (!matchesActivity(activityFilter, lead)) return false;

      const scoreBand = getScoreBand(getLeadScore(lead).score);
      if (scoreFilter !== "all" && scoreBand !== scoreFilter) return false;

      return true;
    });

    rows.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === "latest" ? bTime - aTime : aTime - bTime;
    });

    return rows;
  }, [data, search, stageFilter, serviceFilter, sourceFilter, selectedPriorities, urgentOnly, daysFilter, followUpFilter, activityFilter, scoreFilter, sortOrder]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredRows, currentPage],
  );

  const setPriority = (value: string, checked: boolean) => {
    setSelectedPriorities((current) =>
      checked ? [...current, value] : current.filter((v) => v !== value),
    );
    setPage(1);
  };

  const clearLeadFilters = () => {
    setSearch("");
    setStageFilter("all");
    setServiceFilter("all");
    setSourceFilter("all");
    setSortOrder("latest");
    setSelectedPriorities([]);
    setDaysFilter("all");
    setUrgentOnly(false);
    setFollowUpFilter("all");
    setActivityFilter("all");
    setScoreFilter("all");
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success("Lead deleted");
    setDeleteId(null);
    qc.invalidateQueries();
  };

  const quickStageChange = async (leadId: string, newStage: PipelineStage) => {
    const { error } = await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({
      lead_id: leadId,
      type: "stage",
      description: `Stage changed to ${PIPELINE_STAGES.find((s) => s.value === newStage)?.label}`,
    });
    toast.success("Stage updated");
    qc.invalidateQueries();
  };

  const exportCSV = async () => {
    const rows = filteredRows;
    if (!rows.length) return toast.error("No leads to export");

    const headers = ["Name", "Email", "Phone", "WhatsApp", "City", "Country", "Service", "Stage", "Priority", "Source", "Created"];
    const csvRows = rows.map((l) => [
      l.full_name,
      l.email ?? "",
      l.phone ?? "",
      l.whatsapp ?? "",
      l.city ?? "",
      l.country ?? "",
      l.services?.name ?? "",
      PIPELINE_STAGES.find((s) => s.value === l.stage)?.label ?? l.stage,
      PRIORITIES.find((p) => p.value === l.priority)?.label ?? l.priority,
      l.source ?? "",
      format(new Date(l.created_at), "yyyy-MM-dd"),
    ]);

    const csv = [headers, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">{data?.count ?? 0} total</p>
          <p className="text-xs text-muted-foreground">{filteredRows.length} matching your filters</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
            <Upload className="size-4" /> Import
          </Button>
          <Button variant="outline" onClick={() => setVoiceOpen(true)} className="gap-1.5">
            <Mic className="size-4" /> Voice
          </Button>
          <Button onClick={() => { setEditing(null); setSheetOpen(true); }} className="gap-1.5">
            <Plus className="size-4" /> New lead
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, email, phone…"
                className="pl-8"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="size-4 text-primary" />
                Lead filters
              </div>
              <Button variant="ghost" size="sm" onClick={clearLeadFilters} className="h-8 px-2 text-xs">
                Clear filters
              </Button>
            </div>

            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 grid-rows-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <SortDesc className="size-3.5" /> Sort
                </div>
                <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as "latest" | "oldest"); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sort by date" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Flame className="size-3.5" /> Urgency
                </div>
                <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <Checkbox checked={urgentOnly} onCheckedChange={(v) => { setUrgentOnly(Boolean(v)); setPage(1); }} />
                  Urgent leads only
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" /> Created within days
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={daysFilter === "all" ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => { setDaysFilter("all"); setPage(1); }}>
                    All time
                  </Button>
                  {DAYS_PRESETS.map((days) => (
                    <Button
                      key={days}
                      variant={daysFilter === days ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => { setDaysFilter(days); setPage(1); }}
                    >
                      Last {days} day{days > 1 ? "s" : ""}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Priority</div>
                <div className="flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map((prio) => {
                    const checked = selectedPriorities.includes(prio.value);
                      return (
                      <label key={prio.value} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
                        <Checkbox checked={checked} onCheckedChange={(v) => setPriority(prio.value, Boolean(v))} />
                        <Badge variant="secondary" className={prio.color}>{prio.label}</Badge>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Funnel className="size-3.5" /> Follow-up
                </div>
                <Select value={followUpFilter} onValueChange={(v) => { setFollowUpFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Follow-up status" /></SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_PRESETS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Activity freshness</div>
                <Select value={activityFilter} onValueChange={(v) => { setActivityFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Activity" /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_PRESETS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Lead score</div>
                <Select value={scoreFilter} onValueChange={(v) => { setScoreFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Score" /></SelectTrigger>
                  <SelectContent>
                    {SCORE_PRESETS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Source</div>
                <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {sourceOptions.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Last contact</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : pageRows.length ? pageRows.map((lead) => {
                  const stage = PIPELINE_STAGES.find((s) => s.value === lead.stage);
                  const prio = PRIORITIES.find((p) => p.value === lead.priority);
                  const score = getLeadScore(lead);
                  return (
                    <TableRow key={lead.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to="/leads/$id" params={{ id: lead.id }} className="hover:text-primary">{lead.full_name}</Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.email && <div>{lead.email}</div>}
                        {lead.phone && <div>{lead.phone}</div>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.services?.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Select value={lead.stage} onValueChange={(v) => quickStageChange(lead.id, v as PipelineStage)}>
                          <SelectTrigger className="h-7 text-xs w-[150px] border-0 px-2 focus:ring-0 shadow-none">
                            <Badge variant="outline" className={`${stage?.color} pointer-events-none`}>
                              {stage?.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STAGES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <Badge variant="outline" className={s.color}>{s.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={prio?.color}>{prio?.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={score.badgeClass}>
                          {score.score}/10 {score.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const days = diffDays(new Date(), new Date(lead.updated_at));
                          const text = formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true });
                          const tone =
                            days >= 14 ? "text-destructive" :
                            days >= 7 ? "text-warning-foreground" :
                            "text-muted-foreground";
                          return <span className={tone}>{text}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="size-8">
                            <Link to="/leads/$id" params={{ id: lead.id }}><Eye className="size-3.5" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(lead as any); setSheetOpen(true); }}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteId(lead.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No leads match these filters.
                      {" "}
                      <button
                        className="text-primary hover:underline"
                        onClick={() => { setEditing(null); setSheetOpen(true); }}
                      >
                        Add the first one
                      </button>
                      .
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>

        </CardContent>
      </Card>

      <LeadFormSheet open={sheetOpen} onOpenChange={setSheetOpen} lead={editing as any} />
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => qc.invalidateQueries()} />
      <VoiceLeadDialog open={voiceOpen} onOpenChange={setVoiceOpen} onDone={() => qc.invalidateQueries()} />
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All related activities, follow-ups and documents will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default LeadsPage;