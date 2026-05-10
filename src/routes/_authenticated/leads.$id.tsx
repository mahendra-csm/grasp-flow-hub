import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Plus, Upload, Loader2,
  CheckCircle2, Sparkles, RefreshCw, MessageCircle,
} from "lucide-react";
import { PIPELINE_STAGES, PRIORITIES } from "@/lib/constants";
import { LeadFormSheet } from "@/components/lead-form-sheet";
import { EmailDraftSheet } from "@/components/email-draft-sheet";
import { WhatsAppSheet } from "@/components/whatsapp-sheet";
import { scoreLead } from "@/lib/scoring";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { summarizeLead, suggestNextAction } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiLoadingSummary, setAiLoadingSummary] = useState(false);
  const [aiLoadingAction, setAiLoadingAction] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, services(name, color, icon)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["activities", id],
    queryFn: async () =>
      (await supabase.from("activities").select("*").eq("lead_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: followups } = useQuery({
    queryKey: ["followups", id],
    queryFn: async () =>
      (await supabase.from("followups").select("*").eq("lead_id", id).order("due_date")).data ?? [],
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", id],
    queryFn: async () =>
      (await supabase.from("documents").select("*").eq("lead_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!lead) return <div className="text-sm">Lead not found. <Link to="/leads" className="text-primary">Back to leads</Link></div>;

  const stage = PIPELINE_STAGES.find((s) => s.value === lead.stage);
  const prio = PRIORITIES.find((p) => p.value === lead.priority);
  const score = scoreLead({
    stage: lead.stage,
    priority: lead.priority,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    lastActivityAt: activities?.[0]?.created_at ?? null,
  });

  const addFollowup = async () => {
    if (!followupDate) return toast.error("Pick a date");
    const { error } = await supabase.from("followups").insert({
      lead_id: id,
      due_date: new Date(followupDate).toISOString(),
      notes: followupNote || null,
    });
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({
      lead_id: id,
      type: "followup",
      description: `Follow-up scheduled for ${format(new Date(followupDate), "MMM d, p")}`,
    });
    toast.success("Follow-up scheduled");
    setFollowupDate("");
    setFollowupNote("");
    qc.invalidateQueries();
  };

  const completeFollowup = async (followupId: string) => {
    const { error } = await supabase
      .from("followups")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", followupId);
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({
      lead_id: id,
      type: "followup",
      description: "Follow-up marked as completed",
    });
    toast.success("Follow-up completed");
    qc.invalidateQueries();
  };

  const addActivity = async () => {
    if (!activityNote.trim()) return;
    const { error } = await supabase
      .from("activities")
      .insert({ lead_id: id, type: "note", description: activityNote.trim() });
    if (error) return toast.error(error.message);
    setActivityNote("");
    qc.invalidateQueries({ queryKey: ["activities", id] });
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("lead-documents").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error } = await supabase.from("documents").insert({
      lead_id: id,
      name: file.name,
      file_type: file.type,
      storage_path: path,
      size_bytes: file.size,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    await supabase.from("activities").insert({ lead_id: id, type: "document", description: `Uploaded ${file.name}` });
    toast.success("File uploaded");
    qc.invalidateQueries();
  };

  const downloadDoc = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("lead-documents").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const handleSummarize = async () => {
    setAiLoadingSummary(true);
    setAiSummary(null);
    try {
      const result = await summarizeLead({
        data: {
          name: lead.full_name,
          stage: stage?.label ?? lead.stage,
          priority: prio?.label ?? lead.priority,
          source: lead.source,
          service: (lead as any).services?.name,
          notes: lead.notes,
          activities: activities?.slice(0, 5).map((a) => `[${a.type}] ${a.description}`) ?? [],
          followups: followups?.slice(0, 3).map((f) => `${format(new Date(f.due_date), "MMM d")} — ${f.status}${f.notes ? `: ${f.notes}` : ""}`) ?? [],
        },
      });
      setAiSummary(result);
    } catch (e: any) {
      toast.error("AI request failed: " + e.message);
    } finally {
      setAiLoadingSummary(false);
    }
  };

  const handleSuggestAction = async () => {
    setAiLoadingAction(true);
    setAiAction(null);
    try {
      const lastAct = activities?.[0]?.description ?? null;
      const result = await suggestNextAction({
        data: {
          name: lead.full_name,
          stage: stage?.label ?? lead.stage,
          priority: prio?.label ?? lead.priority,
          service: (lead as any).services?.name,
          lastActivity: lastAct,
          notes: lead.notes,
        },
      });
      setAiAction(result);
    } catch (e: any) {
      toast.error("AI request failed: " + e.message);
    } finally {
      setAiLoadingAction(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav({ to: "/leads" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{lead.full_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={stage?.color}>{stage?.label}</Badge>
              <Badge variant="secondary" className={prio?.color}>{prio?.label}</Badge>
              {(lead as any).services?.name && <Badge variant="outline">{(lead as any).services.name}</Badge>}
              <Badge variant="outline" className={score.badgeClass}>{score.score}/10 {score.label}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(lead.phone || lead.whatsapp) && (
            <Button onClick={() => setWhatsappOpen(true)} variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
              <MessageCircle className="size-3.5" /> WhatsApp
            </Button>
          )}
          {lead.email && (
            <Button onClick={() => setEmailOpen(true)} variant="outline" className="gap-1.5">
              <Mail className="size-3.5" /> Draft Email
            </Button>
          )}
          <Button onClick={() => setEditOpen(true)} variant="outline" className="gap-1.5">
            <Pencil className="size-3.5" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="shadow-soft lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {lead.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{lead.email}</div>}
            {lead.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{lead.phone}</div>}
            {lead.whatsapp && <div className="flex items-center gap-2 text-success"><Phone className="size-4" />{lead.whatsapp} (WhatsApp)</div>}
            {(lead.city || lead.country) && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {[lead.city, lead.country].filter(Boolean).join(", ")}
              </div>
            )}
            {lead.source && <div className="text-muted-foreground text-xs">Source: {lead.source}</div>}
            {lead.follow_up_date && (
              <div className="flex items-center gap-2 pt-2 border-t mt-2">
                <Calendar className="size-4 text-primary" />
                <span>Next: {format(new Date(lead.follow_up_date), "PPp")}</span>
              </div>
            )}
            {lead.notes && <div className="pt-2 border-t mt-2 text-muted-foreground whitespace-pre-wrap">{lead.notes}</div>}
            {lead.custom_data && Object.keys(lead.custom_data as Record<string, any>).length > 0 && (
              <div className="pt-2 border-t mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom</p>
                {Object.entries(lead.custom_data as Record<string, any>).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="size-3.5" /> AI Insights
              </TabsTrigger>
            </TabsList>

            {/* ACTIVITY TAB */}
            <TabsContent value="activity" className="space-y-3">
              <Card className="shadow-soft">
                <CardContent className="pt-4 space-y-2">
                  <Textarea
                    rows={2}
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    placeholder="Log a note or call summary…"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addActivity}><Plus className="size-3.5 mr-1" /> Add note</Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-4">
                  {activities?.length ? (
                    <div className="space-y-3">
                      {activities.map((a) => (
                        <div key={a.id} className="flex gap-3 text-sm">
                          <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <p>{a.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })} • {a.type}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* FOLLOW-UPS TAB */}
            <TabsContent value="followups" className="space-y-3">
              <Card className="shadow-soft">
                <CardContent className="pt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="datetime-local"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                    />
                    <Input
                      value={followupNote}
                      onChange={(e) => setFollowupNote(e.target.value)}
                      placeholder="Note (optional)"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addFollowup}>
                      <Plus className="size-3.5 mr-1" /> Schedule follow-up
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-4">
                  {followups?.length ? (
                    <div className="space-y-2">
                      {followups.map((f) => {
                        const overdue = f.status === "pending" && new Date(f.due_date) < new Date();
                        const isPending = f.status === "pending";
                        return (
                          <div key={f.id} className="flex items-center justify-between text-sm border rounded-md p-2.5 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{format(new Date(f.due_date), "PPp")}</div>
                              {f.notes && <div className="text-xs text-muted-foreground">{f.notes}</div>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={
                                  overdue
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : f.status === "completed"
                                      ? "bg-success/10 text-success border-success/20"
                                      : "bg-info/10 text-info border-info/20"
                                }
                              >
                                {overdue ? "Overdue" : f.status}
                              </Badge>
                              {isPending && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-success hover:text-success hover:bg-success/10"
                                  title="Mark as completed"
                                  onClick={() => completeFollowup(f.id)}
                                >
                                  <CheckCircle2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No follow-ups scheduled.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents" className="space-y-3">
              <Card className="shadow-soft">
                <CardContent className="pt-4">
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-muted/30 transition">
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading…" : "Click to upload PDF, image, certificate, etc."}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                    />
                  </label>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-4">
                  {documents?.length ? (
                    <div className="space-y-2">
                      {documents.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => downloadDoc(d.storage_path, d.name)}
                          className="w-full flex items-center justify-between text-sm border rounded-md p-2.5 hover:bg-muted/50 text-left"
                        >
                          <div>
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.file_type} • {((d.size_bytes ?? 0) / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <span className="text-xs text-primary">Download</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI INSIGHTS TAB */}
            <TabsContent value="ai" className="space-y-3">
              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" /> Lead Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {aiSummary ? (
                    <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3 leading-relaxed">
                      {aiSummary}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Get an AI-generated summary of this lead's status, key observations, and recommended action.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSummarize}
                    disabled={aiLoadingSummary}
                    className="gap-1.5"
                  >
                    {aiLoadingSummary ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {aiSummary ? "Refresh Summary" : "Summarize Lead"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" /> Suggested Next Action
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {aiAction ? (
                    <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3 leading-relaxed">
                      {aiAction}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Get an AI recommendation on what to do next with this lead — including timing and a message template.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSuggestAction}
                    disabled={aiLoadingAction}
                    className="gap-1.5"
                  >
                    {aiLoadingAction ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {aiAction ? "Refresh Suggestion" : "Suggest Next Action"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <LeadFormSheet open={editOpen} onOpenChange={setEditOpen} lead={lead as any} />

      {(lead.phone || lead.whatsapp) && (
        <WhatsAppSheet
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          lead={{
            full_name: lead.full_name,
            phone: lead.phone ?? null,
            whatsapp: lead.whatsapp ?? null,
            stage: stage?.label ?? lead.stage,
            service: (lead as any).services?.name ?? null,
            lastActivity: activities?.[0]?.description ?? null,
          }}
          onSent={async () => {
            await supabase.from("activities").insert({
              lead_id: id,
              type: "whatsapp",
              description: `WhatsApp message prepared for ${lead.whatsapp || lead.phone}`,
            });
            qc.invalidateQueries({ queryKey: ["activities", id] });
          }}
        />
      )}

      {lead.email && (
        <EmailDraftSheet
          open={emailOpen}
          onOpenChange={setEmailOpen}
          lead={{
            id: lead.id,
            full_name: lead.full_name,
            email: lead.email,
            stage: stage?.label ?? lead.stage,
            service: (lead as any).services?.name ?? null,
            notes: lead.notes ?? null,
            lastActivity: activities?.[0]?.description ?? null,
          }}
          onSent={async () => {
            await supabase.from("activities").insert({
              lead_id: id,
              type: "email",
              description: `AI-drafted follow-up email prepared for ${lead.email}`,
            });
            qc.invalidateQueries({ queryKey: ["activities", id] });
          }}
        />
      )}
    </div>
  );
}
