import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { PIPELINE_STAGES } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conferences/leads")({
  component: ConferenceLeadsPage,
});

type ConferenceLead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  stage: string;
  priority: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  custom_data: Record<string, unknown> | null;
};

const FORM_TYPE_META: Record<
  string,
  { label: string; icon: typeof Users; tone: string; description: string }
> = {
  abstract: {
    label: "Abstract Submission",
    icon: FileText,
    tone: "bg-info/10 text-info border-info/20",
    description: "Author submitted an abstract for review",
  },
  registration: {
    label: "Registration",
    icon: CreditCard,
    tone: "bg-success/10 text-success border-success/20",
    description: "Paid conference registration",
  },
  guidelines: {
    label: "Guidelines Download",
    icon: Download,
    tone: "bg-warning/10 text-warning-foreground border-warning/30",
    description: "Requested abstract guidelines PDF",
  },
  sample_abstract: {
    label: "Sample Abstract Request",
    icon: FileText,
    tone: "bg-primary/10 text-primary border-primary/20",
    description: "Requested a sample abstract",
  },
  counselling: {
    label: "Counselling Booking",
    icon: MessageCircle,
    tone: "bg-accent text-accent-foreground border-border",
    description: "Booked a free counselling session",
  },
  other: {
    label: "Website Form",
    icon: Users,
    tone: "bg-muted text-muted-foreground border-border",
    description: "Submitted a website form",
  },
};

function getFormType(cd: Record<string, unknown> | null): string {
  const t = cd?.form_type;
  if (typeof t !== "string") return "other";
  return FORM_TYPE_META[t] ? t : "other";
}

function ConferenceLeadsPage() {
  const [search, setSearch] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState<string>("all");

  const { data: leads, isLoading } = useQuery<ConferenceLead[]>({
    queryKey: ["conference-leads-all"],
    queryFn: async () => {
      // Pull leads that came from the website AND have any conference/counselling context.
      // We over-fetch and filter in JS so we don't depend on a single field being set.
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, email, phone, whatsapp, country, stage, priority, source, notes, created_at, custom_data")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      return ((data ?? []) as ConferenceLead[]).filter((l) => {
        const cd = l.custom_data ?? {};
        const ft = (cd as any).form_type;
        const hasConf = !!(cd as any).conf_title || !!(cd as any).conf_code;
        return (
          hasConf ||
          ft === "abstract" ||
          ft === "registration" ||
          ft === "guidelines" ||
          ft === "sample_abstract" ||
          ft === "counselling"
        );
      });
    },
  });

  const filtered = useMemo(() => {
    return (leads ?? []).filter((l) => {
      const cd = (l.custom_data ?? {}) as Record<string, unknown>;
      if (formTypeFilter !== "all" && getFormType(cd) !== formTypeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const haystack = [
        l.full_name,
        l.email,
        l.phone,
        cd.conf_title,
        cd.conf_code,
        cd.conf_category,
        cd.institution,
        cd.payment_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, search, formTypeFilter]);

  const stats = useMemo(() => {
    const all = leads ?? [];
    const by = (t: string) =>
      all.filter((l) => getFormType(l.custom_data ?? null) === t).length;
    return {
      total: all.length,
      abstracts: by("abstract"),
      registrations: by("registration"),
      guidelines: by("guidelines"),
      samples: by("sample_abstract"),
      counselling: by("counselling"),
    };
  }, [leads]);

  const exportCSV = () => {
    if (!filtered.length) return toast.error("No leads to export");
    const headers = [
      "Submitted",
      "Form Type",
      "Name",
      "Email",
      "Phone",
      "Country",
      "Conference",
      "Conference Code",
      "Conference Dates",
      "Conference Category",
      "Conference URL",
      "Stage",
      "Source",
      "Extra",
    ];
    const rows = filtered.map((l) => {
      const cd = (l.custom_data ?? {}) as Record<string, unknown>;
      const ft = getFormType(cd);
      const extras: string[] = [];
      if (ft === "registration") {
        extras.push(
          `${cd.currency ?? ""} ${cd.amount ?? ""}`.trim(),
          `Tier: ${cd.tier ?? ""}`,
          `Reg type: ${cd.reg_type ?? ""}`,
          `Payment: ${cd.payment_method ?? ""} ${cd.payment_id ?? ""}`,
          `Institution: ${cd.institution ?? ""}`,
        );
      } else if (ft === "abstract") {
        extras.push(`Presentation: ${cd.presentation_type ?? ""}`);
      } else if (ft === "counselling") {
        extras.push(
          `Service: ${cd.service_requested ?? ""}`,
          `Date: ${cd.preferred_date ?? ""}`,
          `Slot: ${cd.preferred_slot ?? ""}`,
        );
      } else if (ft === "guidelines" || ft === "sample_abstract") {
        if (cd.query) extras.push(`Query: ${cd.query}`);
        if (cd.comment) extras.push(`Comment: ${cd.comment}`);
      }
      return [
        format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
        FORM_TYPE_META[ft]?.label ?? ft,
        l.full_name,
        l.email ?? "",
        l.phone ?? "",
        l.country ?? "",
        String(cd.conf_title ?? ""),
        String(cd.conf_code ?? ""),
        String(cd.conf_dates ?? ""),
        String(cd.conf_category ?? ""),
        String(cd.conf_page ?? ""),
        l.stage,
        l.source ?? "",
        extras.filter(Boolean).join(" | "),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conference-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} leads`);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 gap-1.5 text-muted-foreground">
            <Link to="/conferences"><ArrowLeft className="size-3.5" /> Back to conferences</Link>
          </Button>
          <h1 className="text-2xl font-semibold">Conference Leads</h1>
          <p className="text-sm text-muted-foreground">
            All form submissions from the conference website — abstracts, registrations, guidelines requests, sample abstract requests and counselling bookings.
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-1.5" disabled={!filtered.length}>
          <Download className="size-4" /> Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatPill label="Total"        value={stats.total}        tone="bg-muted text-foreground" />
        <StatPill label="Abstracts"    value={stats.abstracts}    tone="bg-info/10 text-info" />
        <StatPill label="Registrations" value={stats.registrations} tone="bg-success/10 text-success" />
        <StatPill label="Guidelines"   value={stats.guidelines}   tone="bg-warning/10 text-warning-foreground" />
        <StatPill label="Sample reqs"  value={stats.samples}      tone="bg-primary/10 text-primary" />
        <StatPill label="Counselling"  value={stats.counselling}  tone="bg-accent text-accent-foreground" />
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, conference, payment id…"
                className="pl-8"
              />
            </div>
            <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Form type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All form types</SelectItem>
                <SelectItem value="abstract">Abstract submissions</SelectItem>
                <SelectItem value="registration">Registrations</SelectItem>
                <SelectItem value="guidelines">Guidelines downloads</SelectItem>
                <SelectItem value="sample_abstract">Sample abstract requests</SelectItem>
                <SelectItem value="counselling">Counselling bookings</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center space-y-2">
              <Users className="size-10 mx-auto text-muted-foreground/40" />
              <p className="font-medium">No conference leads {search || formTypeFilter !== "all" ? "match your filters" : "yet"}</p>
              <p className="text-sm text-muted-foreground">
                When someone submits a form on a conference page, they'll appear here with all their submission details.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold leading-tight">{value}</p>
    </div>
  );
}

function LeadRow({ lead }: { lead: ConferenceLead }) {
  const cd = (lead.custom_data ?? {}) as Record<string, unknown>;
  const ft = getFormType(cd);
  const meta = FORM_TYPE_META[ft] ?? FORM_TYPE_META.other;
  const stage = PIPELINE_STAGES.find((s) => s.value === lead.stage);
  const FormIcon = meta.icon;

  const confTitle = String(cd.conf_title ?? "");
  const confCode = String(cd.conf_code ?? "");
  const confDates = String(cd.conf_dates ?? "");
  const confCategory = String(cd.conf_category ?? "");
  const confPage = String(cd.conf_page ?? "");

  return (
    <div className="rounded-xl border bg-background p-4 hover:shadow-soft transition">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${meta.tone} gap-1`}>
              <FormIcon className="size-3" /> {meta.label}
            </Badge>
            {stage && <Badge variant="outline" className={stage.color}>{stage.label}</Badge>}
            <span className="text-xs text-muted-foreground">
              {format(new Date(lead.created_at), "MMM d, yyyy 'at' p")} ·{" "}
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
            </span>
          </div>

          <div>
            <Link
              to="/leads/$id"
              params={{ id: lead.id }}
              className="text-base font-semibold hover:text-primary inline-flex items-center gap-1"
            >
              {lead.full_name}
              <ArrowUpRight className="size-3.5" />
            </Link>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <Mail className="size-3" /> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <Phone className="size-3" /> {lead.phone}
                </a>
              )}
              {lead.country && <span>{lead.country}</span>}
              {cd.institution ? <span>· {String(cd.institution)}</span> : null}
            </div>
          </div>

          {confTitle && (
            <div className="rounded-lg bg-muted/40 border px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarDays className="size-3.5 text-primary" />
                <span className="text-sm font-medium">{confTitle}</span>
                {confCode && <Badge variant="outline" className="text-[10px] font-mono">{confCode}</Badge>}
                {confCategory && <Badge variant="secondary" className="text-[10px]">{confCategory}</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {confDates && <span>{confDates}</span>}
                {confPage && (
                  <a href={confPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                    <ExternalLink className="size-3" /> Open conference page
                  </a>
                )}
              </div>
            </div>
          )}

          <FormSpecificDetails ft={ft} cd={cd} />

          {lead.notes && (
            <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2 line-clamp-3">
              {lead.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FormSpecificDetails({ ft, cd }: { ft: string; cd: Record<string, unknown> }) {
  if (ft === "registration") {
    return (
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <DetailItem label="Registration type" value={cd.reg_type} />
        <DetailItem label="Tier" value={cd.tier} />
        <DetailItem label="Amount paid" value={`${cd.currency ?? ""} ${cd.amount ?? ""}`.trim()} />
        <DetailItem label="Payment method" value={cd.payment_method} />
        <DetailItem label="Payment ID" value={cd.payment_id} mono />
        <DetailItem label="Participants" value={`${cd.participants ?? 1} (${cd.accompanying ?? 0} accompanying)`} />
      </div>
    );
  }
  if (ft === "abstract") {
    return (
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <DetailItem label="Presentation type" value={cd.presentation_type} />
        <DetailItem label="Title prefix" value={cd.title_prefix} />
      </div>
    );
  }
  if (ft === "counselling") {
    return (
      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        <DetailItem label="Service" value={cd.service_requested} />
        <DetailItem label="Preferred date" value={cd.preferred_date} />
        <DetailItem label="Preferred slot" value={cd.preferred_slot} />
      </div>
    );
  }
  if (ft === "guidelines" || ft === "sample_abstract") {
    const text = cd.query ?? cd.comment;
    if (!text) return null;
    return (
      <div className="text-xs">
        <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-medium mb-1">
          {cd.query ? "Query" : "Comment"}
        </p>
        <p className="text-foreground/80">{String(text)}</p>
      </div>
    );
  }
  return null;
}

function DetailItem({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  const str = value == null ? "" : String(value).trim();
  if (!str) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      <span className={mono ? "font-mono text-foreground" : "text-foreground"}>{str}</span>
    </div>
  );
}
