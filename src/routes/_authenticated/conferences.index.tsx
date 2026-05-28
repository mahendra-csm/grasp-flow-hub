import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { PIPELINE_STAGES } from "@/lib/constants";
import {
  CalendarDays,
  CirclePlus,
  ClipboardList,
  LayoutList,
  MapPin,
  Sparkles,
  CheckCircle2,
  Plus,
  Users,
  Mail,
  Phone,
  ArrowUpRight,
  FileText,
  CreditCard,
  Download,
  MessageCircle,
} from "lucide-react";
import {
  buildConferenceChecklistItems,
  conferencePhaseMeta,
  phaseItems,
  progress,
  type Conference,
  type ConferenceChecklistItem,
  type ConferencePhase,
} from "@/lib/conferences";

export const Route = createFileRoute("/_authenticated/conferences/")({
  component: ConferencesPage,
});

const phaseOrder: ConferencePhase[] = ["pre", "during", "post"];

type ConferenceWithCode = Conference & { code?: string | null };

type ConferenceLead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  priority: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  custom_data: Record<string, unknown> | null;
};

const FORM_TYPE_META: Record<string, { label: string; icon: typeof Users; tone: string }> = {
  abstract:        { label: "Abstract",         icon: FileText,       tone: "bg-info/10 text-info border-info/20" },
  registration:    { label: "Registration",     icon: CreditCard,     tone: "bg-success/10 text-success border-success/20" },
  guidelines:      { label: "Guidelines",       icon: Download,       tone: "bg-warning/10 text-warning-foreground border-warning/30" },
  sample_abstract: { label: "Sample abstract",  icon: FileText,       tone: "bg-muted text-muted-foreground border-border" },
  counselling:     { label: "Counselling",      icon: MessageCircle,  tone: "bg-primary/10 text-primary border-primary/20" },
  other:           { label: "Other",            icon: Users,          tone: "bg-muted text-muted-foreground border-border" },
};

function ConferencesPage() {
  const qc = useQueryClient();
  const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const { data: conferences, isLoading: conferencesLoading } = useQuery({
    queryKey: ["conferences-all"],
    queryFn: async () => (await supabase.from("conferences").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: checklistItems, isLoading: checklistLoading } = useQuery({
    queryKey: ["conference-checklist-items", selectedConferenceId],
    queryFn: async () => {
      if (!selectedConferenceId) return [];
      return (
        await supabase
          .from("conference_checklist_items")
          .select("*")
          .eq("conference_id", selectedConferenceId)
          .order("phase")
          .order("sort_order")
      ).data ?? [];
    },
    enabled: !!selectedConferenceId,
  });

  useEffect(() => {
    if (!selectedConferenceId && conferences?.length) {
      setSelectedConferenceId(conferences[0].id);
    }
  }, [conferences, selectedConferenceId]);

  const selectedConference = useMemo(
    () => conferences?.find((item) => item.id === selectedConferenceId) ?? conferences?.[0] ?? null,
    [conferences, selectedConferenceId],
  );

  const selectedItems = useMemo(() => {
    if (!selectedConference) return [] as ConferenceChecklistItem[];
    return (checklistItems ?? []) as ConferenceChecklistItem[];
  }, [checklistItems, selectedConference]);

  const overall = progress(selectedItems);

  const phaseStats = useMemo(() => {
    return phaseOrder.map((phase) => {
      const items = phaseItems(selectedItems, phase);
      const stat = progress(items);
      return { phase, ...conferencePhaseMeta[phase], ...stat, items };
    });
  }, [selectedItems]);

  const conferenceCode = ((selectedConference as ConferenceWithCode | null)?.code ?? "").trim();
  const conferenceTitle = (selectedConference?.title ?? (selectedConference as any)?.name ?? "").trim();

  const { data: conferenceLeads, isLoading: leadsLoading } = useQuery<ConferenceLead[]>({
    queryKey: ["conference-leads", conferenceCode || conferenceTitle],
    enabled: !!selectedConference && (conferenceCode.length > 0 || conferenceTitle.length > 0),
    queryFn: async () => {
      // Match by code first (precise), then fall back to title match
      let query = supabase
        .from("leads")
        .select("id, full_name, email, phone, stage, priority, source, notes, created_at, updated_at, custom_data")
        .order("created_at", { ascending: false })
        .limit(200);

      if (conferenceCode) {
        query = query.eq("custom_data->>conf_code", conferenceCode);
      } else {
        query = query.eq("custom_data->>conf_title", conferenceTitle);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ConferenceLead[];
    },
  });

  const leadStats = useMemo(() => {
    const list = conferenceLeads ?? [];
    const byType = new Map<string, number>();
    list.forEach((l) => {
      const t = (l.custom_data as any)?.form_type ?? "other";
      byType.set(t, (byType.get(t) ?? 0) + 1);
    });
    return {
      total: list.length,
      registrations: byType.get("registration") ?? 0,
      abstracts: byType.get("abstract") ?? 0,
      guidelines: byType.get("guidelines") ?? 0,
      samples: byType.get("sample_abstract") ?? 0,
    };
  }, [conferenceLeads]);

  const exportLeadsCSV = () => {
    const rows = conferenceLeads ?? [];
    if (!rows.length) return toast.error("No leads to export yet");
    const headers = ["Name", "Email", "Phone", "Form type", "Stage", "Source", "Conf code", "Submitted"];
    const csvRows = rows.map((l) => {
      const cd = (l.custom_data ?? {}) as Record<string, unknown>;
      return [
        l.full_name,
        l.email ?? "",
        l.phone ?? "",
        String(cd.form_type ?? ""),
        l.stage,
        l.source ?? "",
        String(cd.conf_code ?? ""),
        format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
      ];
    });
    const csv = [headers, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (conferenceCode || conferenceTitle || "conference").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `${slug}-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  };

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("Conference name is required");
    const { data, error } = await supabase
      .from("conferences")
      .insert({
        name: title.trim(),
        title: title.trim(),
        code: code.trim() || null,
        venue: venue.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
      } as never)
      .select("*")
      .single();

    if (error) return toast.error(error.message);

    const checklist = buildConferenceChecklistItems((data as Conference).id);
    const { error: checklistError } = await supabase.from("conference_checklist_items").insert(checklist);
    if (checklistError) return toast.error(checklistError.message);

    toast.success("Conference created");
    setCreateOpen(false);
    setTitle("");
    setCode("");
    setVenue("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["conferences-all"] });
    qc.invalidateQueries({ queryKey: ["conference-checklist-items"] });
    setSelectedConferenceId((data as Conference).id);
  };

  const toggleItem = async (item: ConferenceChecklistItem, completed: boolean) => {
    const { error } = await supabase
      .from("conference_checklist_items")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", item.id as string);

    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conference-checklist-items", selectedConferenceId] });
    qc.invalidateQueries({ queryKey: ["conferences-all"] });
  };

  const activeLoading = conferencesLoading || checklistLoading;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Conference checklist tracking
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Conferences</h1>
            <p className="text-sm text-muted-foreground">
              Manage each conference and track pre, during, and post-event checklist progress.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
          <CirclePlus className="size-4" /> Add conference
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="shadow-soft min-h-[720px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutList className="size-4 text-primary" /> Conference list
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conferences?.length ? (
              <div className="space-y-2">
                {conferences.map((conference) => {
                  const items = (checklistItems ?? []).filter((item) => item.conference_id === conference.id) as ConferenceChecklistItem[];
                  const stat = progress(items);
                  const isActive = conference.id === selectedConference?.id;
                  const conferenceName = conference.title ?? (conference as any).name ?? "Untitled Conference";
                  return (
                    <button
                      key={conference.id}
                      onClick={() => setSelectedConferenceId(conference.id)}
                      className={`w-full rounded-xl border p-3 text-left transition hover:shadow-soft ${isActive ? "border-primary bg-primary/5 shadow-soft" : "bg-background hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{conferenceName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {[conference.start_date, conference.end_date].filter(Boolean).join(" → ") || "No dates set"}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {stat.percentage}%
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1">
                        <Progress value={stat.percentage} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{stat.completed}/{stat.total} tasks</span>
                          <span>{conference.venue ?? "Venue not set"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : activeLoading ? (
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center space-y-3">
                <ClipboardList className="size-10 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="font-medium">No conferences yet</p>
                  <p className="text-sm text-muted-foreground">Add your first conference to generate the checklist automatically.</p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="size-4" /> Add conference
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft min-h-[720px] overflow-hidden">
          <CardContent className="p-0">
            {selectedConference ? (
              <div className="space-y-0">
                <div className="bg-gradient-to-r from-primary/8 via-background to-emerald-500/10 p-6 border-b">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-background/80">{overall.percentage}% complete</Badge>
                        <Badge variant="secondary" className="bg-background/80">{overall.completed}/{overall.total} items</Badge>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <h2 className="text-2xl font-semibold truncate">{selectedConference.title ?? (selectedConference as any).name ?? "Untitled Conference"}</h2>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> {[selectedConference.start_date, selectedConference.end_date].filter(Boolean).join(" → ") || "Dates not set"}</span>
                          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {selectedConference.venue ?? "Venue not set"}</span>
                        </div>
                        {selectedConference.description && <p className="text-sm text-muted-foreground max-w-3xl">{selectedConference.description}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Progress value={overall.percentage} className="h-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Informational checklist only — update each item as your team completes it.</span>
                      <span>{overall.percentage}% done</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid gap-3 md:grid-cols-3">
                    {phaseStats.map((phase) => (
                      <div key={phase.phase} className={`rounded-2xl border p-4 ${phase.soft}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide opacity-70">{phase.shortLabel}</p>
                            <p className="font-semibold">{phase.label}</p>
                          </div>
                          <Badge variant="outline" className="bg-background/70">{phase.percentage}%</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Progress value={phase.percentage} className="h-2" />
                          <div className="flex items-center justify-between text-xs opacity-80">
                            <span>{phase.completed}/{phase.total} complete</span>
                            <span>{phase.items.length} tasks</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Tabs defaultValue="pre" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="pre">Before</TabsTrigger>
                      <TabsTrigger value="during">During</TabsTrigger>
                      <TabsTrigger value="post">After</TabsTrigger>
                      <TabsTrigger value="leads" className="gap-1.5">
                        <Users className="size-3.5" />
                        Leads
                        {leadStats.total > 0 && (
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                            {leadStats.total}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    {phaseOrder.map((phase) => {
                      const phaseItemList = phaseItems(selectedItems, phase);
                      const meta = conferencePhaseMeta[phase];
                      return (
                        <TabsContent key={phase} value={phase} className="space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <h3 className="text-base font-semibold">{meta.label}</h3>
                              <p className="text-sm text-muted-foreground">Checklist items are informational — use them to track readiness and completion.</p>
                            </div>
                            <Badge variant="outline" className={meta.soft}>{phaseItems(selectedItems, phase).filter((item) => item.completed).length}/{phaseItemList.length} complete</Badge>
                          </div>

                          <div className="grid gap-3">
                            {phaseItemList.map((item, index) => (
                              <div key={item.id} className="rounded-2xl border bg-background p-4 hover:shadow-soft transition">
                                <div className="flex items-start gap-3">
                                  <div className="pt-0.5">
                                    <Checkbox
                                      checked={!!item.completed}
                                      onCheckedChange={(checked) => toggleItem(item, Boolean(checked))}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step {index + 1}</span>
                                          <Badge variant="secondary" className="text-xs">{meta.shortLabel}</Badge>
                                        </div>
                                        <p className={`font-semibold ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
                                      </div>
                                      {item.completed && (
                                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
                                          <CheckCircle2 className="size-3.5" /> Completed
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      );
                    })}

                    <TabsContent value="leads" className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-base font-semibold">Leads from this conference</h3>
                          <p className="text-sm text-muted-foreground">
                            Captured from website forms.{" "}
                            {conferenceCode
                              ? <>Matched by code <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{conferenceCode}</code>.</>
                              : <span className="text-warning-foreground">Set a Code on this conference (it should match <code className="text-xs bg-muted px-1 rounded">conf_code</code> from your website) for precise matching — falling back to title match.</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link to="/leads">
                              All leads <ArrowUpRight className="size-3.5" />
                            </Link>
                          </Button>
                          {(conferenceLeads?.length ?? 0) > 0 && (
                            <Button variant="outline" size="sm" onClick={exportLeadsCSV} className="gap-1.5">
                              <Download className="size-3.5" /> Export CSV
                            </Button>
                          )}
                        </div>
                      </div>

                      {leadStats.total > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <LeadStatPill label="Total" value={leadStats.total} tone="bg-muted text-foreground" />
                          <LeadStatPill label="Registrations" value={leadStats.registrations} tone="bg-success/10 text-success" />
                          <LeadStatPill label="Abstracts" value={leadStats.abstracts} tone="bg-info/10 text-info" />
                          <LeadStatPill label="Guidelines" value={leadStats.guidelines} tone="bg-warning/10 text-warning-foreground" />
                          <LeadStatPill label="Sample reqs" value={leadStats.samples} tone="bg-primary/10 text-primary" />
                        </div>
                      )}

                      {leadsLoading ? (
                        <div className="space-y-2">
                          <div className="h-16 rounded-xl bg-muted animate-pulse" />
                          <div className="h-16 rounded-xl bg-muted animate-pulse" />
                        </div>
                      ) : (conferenceLeads?.length ?? 0) === 0 ? (
                        <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center space-y-2">
                          <Users className="size-8 mx-auto text-muted-foreground/40" />
                          <p className="font-medium">No leads yet for this conference</p>
                          <p className="text-sm text-muted-foreground">
                            When someone submits an abstract, registers, or requests guidelines/samples on the website, they'll appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(conferenceLeads ?? []).map((lead) => {
                            const cd = (lead.custom_data ?? {}) as Record<string, unknown>;
                            const formType = String(cd.form_type ?? "other");
                            const meta = FORM_TYPE_META[formType] ?? FORM_TYPE_META.other;
                            const stage = PIPELINE_STAGES.find((s) => s.value === lead.stage);
                            const FormIcon = meta.icon;
                            return (
                              <Link
                                key={lead.id}
                                to="/leads/$id"
                                params={{ id: lead.id }}
                                className="block rounded-xl border bg-background p-3 hover:shadow-soft hover:border-primary/40 transition"
                              >
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium truncate">{lead.full_name}</p>
                                      <Badge variant="outline" className={`${meta.tone} gap-1`}>
                                        <FormIcon className="size-3" /> {meta.label}
                                      </Badge>
                                      {stage && <Badge variant="outline" className={stage.color}>{stage.label}</Badge>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                      {lead.email && <span className="inline-flex items-center gap-1"><Mail className="size-3" /> {lead.email}</span>}
                                      {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {lead.phone}</span>}
                                      <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                                    </div>
                                    {formType === "registration" && cd.amount ? (
                                      <p className="text-xs text-muted-foreground">
                                        Paid {String(cd.currency ?? "")} {String(cd.amount)} • {String(cd.reg_type ?? "")}
                                        {cd.payment_id ? <> • Payment <code className="text-[10px]">{String(cd.payment_id)}</code></> : null}
                                      </p>
                                    ) : null}
                                    {formType === "abstract" && cd.presentation_type ? (
                                      <p className="text-xs text-muted-foreground">
                                        Presentation: {String(cd.presentation_type)}
                                      </p>
                                    ) : null}
                                    {lead.notes && formType !== "registration" && formType !== "abstract" && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
                                    )}
                                  </div>
                                  <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            ) : (
              <div className="min-h-[720px] grid place-items-center p-10 text-center">
                <div className="max-w-md space-y-4">
                  <div className="size-16 rounded-2xl bg-primary/10 text-primary mx-auto grid place-items-center">
                    <ClipboardList className="size-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Create a conference hub</h3>
                    <p className="text-sm text-muted-foreground">
                      Add a conference and we’ll generate the pre, during, and post-event checklist so your team can track progress in one place.
                    </p>
                  </div>
                  <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                    <Plus className="size-4" /> Add conference
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create conference</DialogTitle>
            <DialogDescription>
              Add the event details first — the checklist will be created automatically with pre, during, and post steps.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="conference-title">Conference name</Label>
              <Input id="conference-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="International Scientific Conference" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="conference-code">
                Code <span className="text-xs text-muted-foreground font-normal">(optional — match website's <code className="text-[10px] bg-muted px-1 rounded">conf_code</code> to auto-link leads)</span>
              </Label>
              <Input id="conference-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ICFT-2026" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="conference-venue">Venue</Label>
              <Input id="conference-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Dubai, UAE / Online / Hybrid" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conference-start">Start date</Label>
              <Input id="conference-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conference-end">End date</Label>
              <Input id="conference-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="conference-description">Description</Label>
              <Textarea id="conference-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add notes about the conference, goals, or audience." />
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground flex items-start gap-3">
            <ClipboardList className="size-4 mt-0.5 text-primary shrink-0" />
            <p>
              The checklist is preloaded from your conference workflow and can be tracked as a percentage complete.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="size-4" /> Create conference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadStatPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}
