import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  formatDistanceToNow,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  Download,
  Globe2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  TableProperties,
  Target,
  Trash2,
  UserSquare2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/work-tracker")({
  component: WorkTrackerPage,
});

type WorkTrackerEntry = Tables<"work_tracker_entries">;
type WorkTrackerInsert = TablesInsert<"work_tracker_entries">;
type TimeRange = "today" | "7d" | "30d" | "month" | "all";
type OwnerFilter = "mine" | "team";
type CountField =
  | "emails_sent_conferences"
  | "emails_sent_scientific_members"
  | "whatsapp_messages_sent"
  | "email_extraction_count"
  | "contact_extraction_count";

type CountryBreakdown = {
  country: string;
  leads: number;
};

type CountryDraft = {
  id: string;
  country: string;
  leads: string;
};

type TrackerFormState = Record<CountField, string> & {
  notes: string;
  countryDrafts: CountryDraft[];
};

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const METRIC_FIELDS: Array<{ field: CountField; label: string; hint: string }> = [
  {
    field: "emails_sent_conferences",
    label: "Emails sent - conferences",
    hint: "Conference outreach sent today",
  },
  {
    field: "emails_sent_scientific_members",
    label: "Emails sent - scientific members",
    hint: "Scientific member emails sent",
  },
  {
    field: "whatsapp_messages_sent",
    label: "WhatsApp messages sent",
    hint: "Outbound WhatsApp activity",
  },
  {
    field: "email_extraction_count",
    label: "Extraction count of emails",
    hint: "Email records extracted",
  },
  {
    field: "contact_extraction_count",
    label: "Extraction count of contacts",
    hint: "Contact records extracted",
  },
];

function createDraftId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCountryDraft(country = "", leads = ""): CountryDraft {
  return {
    id: createDraftId(),
    country,
    leads,
  };
}

function createEmptyFormState(): TrackerFormState {
  return {
    emails_sent_conferences: "0",
    emails_sent_scientific_members: "0",
    whatsapp_messages_sent: "0",
    email_extraction_count: "0",
    contact_extraction_count: "0",
    notes: "",
    countryDrafts: [createCountryDraft()],
  };
}

function normalizeCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseCountryBreakdown(value: Json | null | undefined): CountryBreakdown[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CountryBreakdown[]>((accumulator, item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return accumulator;

    const countryValue = item["country"];
    const leadsValue = item["leads"];
    const country = typeof countryValue === "string" ? countryValue : "";
    const parsedLeads =
      typeof leadsValue === "number"
        ? leadsValue
        : typeof leadsValue === "string"
          ? Number.parseInt(leadsValue, 10)
          : 0;

    if (!country && !Number.isFinite(parsedLeads)) return accumulator;

    accumulator.push({
      country,
      leads: Number.isFinite(parsedLeads) ? Math.max(0, Math.trunc(parsedLeads)) : 0,
    });

    return accumulator;
  }, []);
}

function formatCountryBreakdown(rows: CountryBreakdown[]) {
  if (!rows.length) return "No ad campaign leads";
  return rows.map((row) => `${row.country} (${row.leads})`).join(", ");
}

function buildFormState(entry: WorkTrackerEntry | null): TrackerFormState {
  if (!entry) return createEmptyFormState();

  const countryBreakdown = parseCountryBreakdown(entry.ad_campaign_country_breakdown);

  return {
    emails_sent_conferences: String(entry.emails_sent_conferences),
    emails_sent_scientific_members: String(entry.emails_sent_scientific_members),
    whatsapp_messages_sent: String(entry.whatsapp_messages_sent),
    email_extraction_count: String(entry.email_extraction_count),
    contact_extraction_count: String(entry.contact_extraction_count),
    notes: entry.notes ?? "",
    countryDrafts: countryBreakdown.length
      ? countryBreakdown.map((row) => createCountryDraft(row.country, String(row.leads)))
      : [createCountryDraft()],
  };
}

function isInRange(workDate: string, range: TimeRange) {
  const date = startOfDay(new Date(workDate));
  const today = startOfDay(new Date());

  if (range === "all") return true;
  if (range === "today") return isSameDay(date, today);
  if (range === "7d") return date >= startOfDay(subDays(today, 6));
  if (range === "30d") return date >= startOfDay(subDays(today, 29));
  if (range === "month") return date >= startOfMonth(today);

  return true;
}

function startOfCurrentWeek() {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof Mail;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1.5 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkTrackerPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("mine");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<TrackerFormState>(() => createEmptyFormState());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery<WorkTrackerEntry[]>({
    queryKey: ["work-tracker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_tracker_entries")
        .select("*")
        .order("work_date", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedEntry = useMemo(() => {
    if (!user?.id) return null;
    return (
      entries.find((entry) => entry.owner_id === user.id && entry.work_date === selectedDate) ??
      null
    );
  }, [entries, selectedDate, user?.id]);

  const selectedEntryKey = `${selectedDate}:${selectedEntry?.id ?? "new"}:${selectedEntry?.updated_at ?? ""}`;

  useEffect(() => {
    setForm(buildFormState(selectedEntry));
  }, [selectedEntry, selectedEntryKey]);

  const adCampaignLeadTotal = useMemo(
    () => form.countryDrafts.reduce((sum, row) => sum + normalizeCount(row.leads), 0),
    [form.countryDrafts],
  );

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (ownerFilter === "mine" && entry.owner_id !== user?.id) return false;
      if (!isInRange(entry.work_date, timeRange)) return false;

      if (search) {
        const breakdownText = formatCountryBreakdown(
          parseCountryBreakdown(entry.ad_campaign_country_breakdown),
        ).toLowerCase();
        const haystack = [entry.owner_email, entry.work_date, entry.notes ?? "", breakdownText]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [entries, ownerFilter, search, timeRange, user?.id]);

  const summary = useMemo(() => {
    const countryTotals = new Map<string, number>();
    let outreach = 0;
    let extractions = 0;
    let adLeads = 0;
    let conferenceEmails = 0;
    let scientificEmails = 0;
    let whatsappMessages = 0;

    visibleEntries.forEach((entry) => {
      outreach +=
        entry.emails_sent_conferences +
        entry.emails_sent_scientific_members +
        entry.whatsapp_messages_sent;
      extractions += entry.email_extraction_count + entry.contact_extraction_count;
      adLeads += entry.ad_campaign_leads_count;
      conferenceEmails += entry.emails_sent_conferences;
      scientificEmails += entry.emails_sent_scientific_members;
      whatsappMessages += entry.whatsapp_messages_sent;

      parseCountryBreakdown(entry.ad_campaign_country_breakdown).forEach((row) => {
        countryTotals.set(row.country, (countryTotals.get(row.country) ?? 0) + row.leads);
      });
    });

    const topCountry = Array.from(countryTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const thisWeekCount = visibleEntries.filter(
      (entry) => startOfDay(new Date(entry.work_date)) >= startOfCurrentWeek(),
    ).length;

    return {
      outreach,
      extractions,
      adLeads,
      logs: visibleEntries.length,
      conferenceEmails,
      scientificEmails,
      whatsappMessages,
      topCountry,
      thisWeekCount,
    };
  }, [visibleEntries]);

  const saveEntry = async () => {
    if (!user?.id || !user.email) {
      toast.error("Your user account is missing an email address.");
      return;
    }

    const activeCountryRows = form.countryDrafts.filter(
      (row) => row.country.trim() || row.leads.trim(),
    );

    const countryBreakdown: CountryBreakdown[] = [];

    for (const row of activeCountryRows) {
      const country = row.country.trim();
      const hasLeadsValue = row.leads.trim().length > 0;

      if (!country || !hasLeadsValue) {
        toast.error("Each ad campaign country row needs both a country and lead count.");
        return;
      }

      countryBreakdown.push({
        country,
        leads: normalizeCount(row.leads),
      });
    }

    const payload: WorkTrackerInsert = {
      owner_id: user.id,
      owner_email: user.email,
      work_date: selectedDate,
      emails_sent_conferences: normalizeCount(form.emails_sent_conferences),
      emails_sent_scientific_members: normalizeCount(form.emails_sent_scientific_members),
      whatsapp_messages_sent: normalizeCount(form.whatsapp_messages_sent),
      email_extraction_count: normalizeCount(form.email_extraction_count),
      contact_extraction_count: normalizeCount(form.contact_extraction_count),
      ad_campaign_leads_count: countryBreakdown.reduce((sum, row) => sum + row.leads, 0),
      ad_campaign_country_breakdown: countryBreakdown as Json,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase
      .from("work_tracker_entries")
      .upsert(payload, { onConflict: "owner_id,work_date" });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(selectedEntry ? "Work log updated." : "Work log saved.");
    await qc.invalidateQueries({ queryKey: ["work-tracker"] });
  };

  const handleDelete = async () => {
    if (!deleteId || !user?.id) return;

    const { error } = await supabase
      .from("work_tracker_entries")
      .delete()
      .eq("id", deleteId)
      .eq("owner_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (selectedEntry?.id === deleteId) {
      setForm(createEmptyFormState());
    }

    setDeleteId(null);
    toast.success("Work log deleted.");
    await qc.invalidateQueries({ queryKey: ["work-tracker"] });
  };

  const exportWorkbook = () => {
    if (!visibleEntries.length) {
      toast.error("No work tracker rows to export.");
      return;
    }

    const sheetRows = visibleEntries.map((entry) => ({
      Date: format(new Date(entry.work_date), "yyyy-MM-dd"),
      Owner: entry.owner_email,
      "Emails sent - conferences": entry.emails_sent_conferences,
      "Emails sent - scientific members": entry.emails_sent_scientific_members,
      "WhatsApp messages sent": entry.whatsapp_messages_sent,
      "Extraction count of emails": entry.email_extraction_count,
      "Extraction count of contacts": entry.contact_extraction_count,
      "Ad campaign leads": entry.ad_campaign_leads_count,
      "Ad campaign countries": formatCountryBreakdown(
        parseCountryBreakdown(entry.ad_campaign_country_breakdown),
      ),
      Notes: entry.notes ?? "",
      "Last updated": format(new Date(entry.updated_at), "yyyy-MM-dd HH:mm"),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Work Tracker");
    XLSX.writeFile(workbook, `work-tracker-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success(`Exported ${visibleEntries.length} work log rows.`);
  };

  const resetForm = () => {
    setForm(buildFormState(selectedEntry));
  };

  const updateMetric = (field: CountField, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateCountryDraft = (id: string, field: "country" | "leads", value: string) => {
    setForm((current) => ({
      ...current,
      countryDrafts: current.countryDrafts.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const addCountryDraft = () => {
    setForm((current) => ({
      ...current,
      countryDrafts: [...current.countryDrafts, createCountryDraft()],
    }));
  };

  const removeCountryDraft = (id: string) => {
    setForm((current) => {
      const next = current.countryDrafts.filter((row) => row.id !== id);
      return {
        ...current,
        countryDrafts: next.length ? next : [createCountryDraft()],
      };
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Work Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Daily outreach and extraction tracking with an Excel-style log inside the CRM.
          </p>
        </div>
        <Button variant="outline" onClick={exportWorkbook} className="gap-1.5">
          <Download className="size-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Outreach sent"
          value={summary.outreach}
          hint={`${summary.conferenceEmails} conference emails, ${summary.scientificEmails} scientific emails, ${summary.whatsappMessages} WhatsApp`}
          icon={Mail}
        />
        <SummaryCard
          title="Extractions"
          value={summary.extractions}
          hint="Email and contact extraction volume"
          icon={TableProperties}
        />
        <SummaryCard
          title="Ad leads"
          value={summary.adLeads}
          hint={
            summary.topCountry
              ? `Top country: ${summary.topCountry[0]} (${summary.topCountry[1]})`
              : "No ad campaign countries logged in this range"
          }
          icon={Target}
        />
        <SummaryCard
          title="Work logs"
          value={summary.logs}
          hint={`${summary.thisWeekCount} rows recorded this week`}
          icon={CalendarDays}
        />
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Daily work log</CardTitle>
              <p className="text-xs text-muted-foreground">
                One row per team member per date. Saving again updates the same day instead of
                creating duplicates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={selectedEntry ? "secondary" : "outline"}>
                {selectedEntry ? "Existing row loaded" : "New row"}
              </Badge>
              <Badge variant="outline">{user?.email ?? "Signed-in user"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="work-date">Work date</Label>
              <Input
                id="work-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pick a day to log or update your work.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {METRIC_FIELDS.map((metric) => (
                <div
                  key={metric.field}
                  className="space-y-2 rounded-xl border bg-background/70 p-4"
                >
                  <Label htmlFor={metric.field}>{metric.label}</Label>
                  <Input
                    id={metric.field}
                    type="number"
                    min="0"
                    step="1"
                    value={form[metric.field]}
                    onChange={(event) => updateMetric(metric.field, event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Ad campaign leads by country</p>
                <p className="text-xs text-muted-foreground">
                  Add country-wise lead counts. The total leads value is calculated automatically.
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Globe2 className="size-3.5" />
                Total ad leads: {adCampaignLeadTotal}
              </Badge>
            </div>

            <div className="space-y-3">
              {form.countryDrafts.map((row) => (
                <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_180px_40px]">
                  <Input
                    value={row.country}
                    onChange={(event) => updateCountryDraft(row.id, "country", event.target.value)}
                    placeholder="Country name"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={row.leads}
                    onChange={(event) => updateCountryDraft(row.id, "leads", event.target.value)}
                    placeholder="Lead count"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 text-destructive"
                    onClick={() => removeCountryDraft(row.id)}
                    aria-label="Remove country row"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addCountryDraft} className="gap-1.5">
              <Plus className="size-4" />
              Add country row
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-notes">Notes</Label>
            <Textarea
              id="work-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional notes about outreach quality, campaign context, blockers, or follow-up."
              className="min-h-28"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              You can view team logs, but only edit or delete your own entries.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
              <Button onClick={saveEntry} className="gap-1.5">
                <Save className="size-4" />
                {selectedEntry ? "Update log" : "Save log"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Work log ledger</CardTitle>
              <p className="text-xs text-muted-foreground">
                Filter by range, switch between your view and team view, then export the filtered
                result to Excel.
              </p>
            </div>
            <Badge variant="outline">{visibleEntries.length} rows</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[180px_180px_1fr]">
            <div className="space-y-2">
              <Label>View</Label>
              <Select
                value={ownerFilter}
                onValueChange={(value) => setOwnerFilter(value as OwnerFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">My logs</SelectItem>
                  <SelectItem value="team">Team logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Range</Label>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work-log-search">Search</Label>
              <Input
                id="work-log-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by owner, country, notes, or date"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Date</TableHead>
                  <TableHead className="min-w-[190px]">Owner</TableHead>
                  <TableHead className="text-right">Conference emails</TableHead>
                  <TableHead className="text-right">Scientific emails</TableHead>
                  <TableHead className="text-right">WhatsApp</TableHead>
                  <TableHead className="text-right">Email extraction</TableHead>
                  <TableHead className="text-right">Contact extraction</TableHead>
                  <TableHead className="text-right">Ad leads</TableHead>
                  <TableHead className="min-w-[220px]">Countries</TableHead>
                  <TableHead className="min-w-[200px]">Notes</TableHead>
                  <TableHead className="min-w-[130px]">Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                      Loading work tracker...
                    </TableCell>
                  </TableRow>
                ) : visibleEntries.length ? (
                  visibleEntries.map((entry) => {
                    const countries = parseCountryBreakdown(entry.ad_campaign_country_breakdown);
                    const isMine = entry.owner_id === user?.id;

                    return (
                      <TableRow key={entry.id} className="align-top">
                        <TableCell className="font-medium">
                          {format(new Date(entry.work_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserSquare2 className="mt-0.5 size-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm">{entry.owner_email}</p>
                              <p className="text-xs text-muted-foreground">
                                {isMine ? "Your row" : "Team row"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.emails_sent_conferences}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.emails_sent_scientific_members}
                        </TableCell>
                        <TableCell className="text-right">{entry.whatsapp_messages_sent}</TableCell>
                        <TableCell className="text-right">{entry.email_extraction_count}</TableCell>
                        <TableCell className="text-right">
                          {entry.contact_extraction_count}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.ad_campaign_leads_count}
                        </TableCell>
                        <TableCell>
                          {countries.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {countries.map((row) => (
                                <Badge
                                  key={`${entry.id}-${row.country}`}
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {row.country}: {row.leads}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No countries logged
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.notes ? entry.notes : "No notes"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isMine ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => {
                                  setSelectedDate(entry.work_date);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => setDeleteId(entry.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Read only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                      No work tracker rows match these filters yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this work log?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected daily tracker row from the CRM ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
