import { scoreLead } from "@/lib/scoring";

export type DashboardLeadRow = {
  id: string;
  full_name: string;
  stage: string;
  priority: string;
  service_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  follow_up_date: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  services: { name: string } | null;
};

export type DashboardFollowupRow = {
  lead_id: string;
  due_date: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
};

export type DashboardActivityRow = {
  lead_id: string;
  created_at: string;
  type: string;
  description: string;
  leads?: { full_name: string } | null;
};

type DimensionRollup = {
  key: string;
  open: number;
  overdue: number;
  hot: number;
  score: number;
};

export type DashboardLeadRecommendation = {
  id: string;
  name: string;
  stage: string;
  priority: string;
  service: string | null;
  source: string | null;
  score: number;
  rankScore: number;
  reason: string;
  nextStep: string;
  timing: string;
  channel: string;
  lastTouchedAt: string;
  staleDays: number;
  followUpDueAt: string | null;
  followUpStatus: string;
  servicePriority: "high" | "medium" | "low";
  sourcePriority: "high" | "medium" | "low";
};

export type DashboardRecommendations = {
  headline: string;
  summary: string;
  focusAreas: string[];
  nextActions: Array<{
    title: string;
    reason: string;
    timing: string;
    priority: "high" | "medium" | "low";
    lead?: string | null;
  }>;
  risks: string[];
  topLeads: DashboardLeadRecommendation[];
  hotLeads: DashboardLeadRecommendation[];
};

const OPEN_STAGES = new Set(["new", "contacted", "interested", "follow_up", "documents_pending", "payment_pending"]);
const ACTION_STAGES = new Set(["interested", "follow_up", "documents_pending", "payment_pending"]);
const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  follow_up: "Follow-up",
  documents_pending: "Documents pending",
  payment_pending: "Payment pending",
  converted: "Converted",
  closed: "Closed",
  lost: "Lost",
};

const STAGE_ACTIONS: Record<string, { nextStep: string; timing: string; channel: string }> = {
  new: {
    nextStep: "Send a short intro and book a discovery call.",
    timing: "today",
    channel: "Email or call",
  },
  contacted: {
    nextStep: "Follow up with a tighter question and ask for the next slot.",
    timing: "within 24 hours",
    channel: "WhatsApp or call",
  },
  interested: {
    nextStep: "Move them toward a proposal, quote, or demo confirmation.",
    timing: "today",
    channel: "WhatsApp or email",
  },
  follow_up: {
    nextStep: "Nudge them with a specific decision point and confirm the next step.",
    timing: "today",
    channel: "WhatsApp or call",
  },
  documents_pending: {
    nextStep: "Send the document checklist and confirm the exact missing items.",
    timing: "within 24 hours",
    channel: "Email or WhatsApp",
  },
  payment_pending: {
    nextStep: "Send invoice/payment details and set a clear payment deadline.",
    timing: "today",
    channel: "Email or WhatsApp",
  },
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function stageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? stage;
}

function pickNextStep(stage: string, hasWhatsapp: boolean, hasPhone: boolean, hasEmail: boolean) {
  const base = STAGE_ACTIONS[stage] ?? {
    nextStep: "Reach out with a targeted follow-up and agree on the next action.",
    timing: "today",
    channel: "Direct outreach",
  };
  const channel = hasWhatsapp ? "WhatsApp" : hasPhone ? "Call" : hasEmail ? "Email" : base.channel;
  return { ...base, channel };
}

function classifyPriority(score: number, maxScore: number): "high" | "medium" | "low" {
  if (!maxScore) return "low";
  const ratio = score / maxScore;
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

function buildRollups(leads: DashboardLeadRow[], followupsByLead: Map<string, DashboardFollowupRow[]>, activitiesByLead: Map<string, DashboardActivityRow[]>) {
  const serviceRollups = new Map<string, DimensionRollup>();
  const sourceRollups = new Map<string, DimensionRollup>();
  const now = new Date();

  const add = (map: Map<string, DimensionRollup>, key: string, lead: DashboardLeadRow, rankBoost: number) => {
    const current = map.get(key) ?? { key, open: 0, overdue: 0, hot: 0, score: 0 };
    const acts = activitiesByLead.get(lead.id) ?? [];
    const lastActivityAt = acts[0]?.created_at ?? lead.updated_at ?? lead.created_at;
    const score = scoreLead({
      stage: lead.stage,
      priority: lead.priority,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      lastActivityAt,
    }).score;
    const open = current.open + 1;
    const followups = followupsByLead.get(lead.id) ?? [];
    const overdue = followups.filter((f) => {
      if (f.status !== "pending") return false;
      const due = parseDate(f.due_date);
      return due ? due < now : false;
    }).length;
    const hot = score >= 7 ? 1 : 0;
    map.set(key, {
      key,
      open,
      overdue: current.overdue + overdue,
      hot: current.hot + hot,
      score: current.score + rankBoost + overdue * 4 + hot * 3,
    });
  };

  for (const lead of leads) {
    if (!OPEN_STAGES.has(lead.stage)) continue;
    if (lead.service_id) add(serviceRollups, lead.service_id, lead, 2);
    if (lead.source) add(sourceRollups, lead.source, lead, 1);
  }

  return { serviceRollups, sourceRollups };
}

export function buildDashboardRecommendations(input: {
  leads: DashboardLeadRow[];
  followups: DashboardFollowupRow[];
  activities: DashboardActivityRow[];
  serviceData: Array<{ name: string; value: number }>;
  stageData: Array<{ stage: string; count: number }>;
  total: number;
  converted: number;
  active: number;
  pendingFollowups: number;
  overdueFollowups: number;
}): DashboardRecommendations {
  const now = new Date();

  const activityByLead = new Map<string, DashboardActivityRow[]>();
  for (const activity of input.activities) {
    const list = activityByLead.get(activity.lead_id) ?? [];
    list.push(activity);
    activityByLead.set(activity.lead_id, list);
  }
  for (const list of activityByLead.values()) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const followupsByLead = new Map<string, DashboardFollowupRow[]>();
  for (const followup of input.followups) {
    const list = followupsByLead.get(followup.lead_id) ?? [];
    list.push(followup);
    followupsByLead.set(followup.lead_id, list);
  }
  for (const list of followupsByLead.values()) {
    list.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  const { serviceRollups, sourceRollups } = buildRollups(input.leads, followupsByLead, activityByLead);
  const maxServiceScore = Math.max(...Array.from(serviceRollups.values()).map((d) => d.score), 0);
  const maxSourceScore = Math.max(...Array.from(sourceRollups.values()).map((d) => d.score), 0);

  const serviceRank = new Map(Array.from(serviceRollups.values()).sort((a, b) => b.score - a.score).map((item, index) => [item.key, index]));
  const sourceRank = new Map(Array.from(sourceRollups.values()).sort((a, b) => b.score - a.score).map((item, index) => [item.key, index]));

  const topLeads = input.leads
    .filter((lead) => OPEN_STAGES.has(lead.stage))
    .map((lead) => {
      const leadActivities = activityByLead.get(lead.id) ?? [];
      const leadFollowups = followupsByLead.get(lead.id) ?? [];
      const pendingFollowups = leadFollowups.filter((f) => f.status === "pending");
      const overdueFollowups = pendingFollowups.filter((f) => {
        const due = parseDate(f.due_date);
        return due ? due < now : false;
      });
      const nextFollowup = pendingFollowups[0] ?? null;
      const lastActivityAt = parseDate(leadActivities[0]?.created_at) ?? parseDate(lead.updated_at) ?? parseDate(lead.created_at) ?? now;
      const daysSinceTouch = daysBetween(now, lastActivityAt);
      const score = scoreLead({
        stage: lead.stage,
        priority: lead.priority,
        email: lead.email,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        lastActivityAt: lastActivityAt.toISOString(),
      }).score;

      const serviceRollup = lead.service_id ? serviceRollups.get(lead.service_id) : null;
      const sourceRollup = lead.source ? sourceRollups.get(lead.source) : null;
      const servicePriority = lead.service_id
        ? classifyPriority(serviceRollup?.score ?? 0, maxServiceScore)
        : "low";
      const sourcePriority = lead.source
        ? classifyPriority(sourceRollup?.score ?? 0, maxSourceScore)
        : "low";

      let rankScore = score * 10;
      if (lead.priority === "urgent") rankScore += 26;
      else if (lead.priority === "high") rankScore += 18;
      else if (lead.priority === "medium") rankScore += 8;

      if (serviceRollup) rankScore += Math.min(16, serviceRollup.score * 0.8);
      if (sourceRollup) rankScore += Math.min(12, sourceRollup.score * 0.6);

      if (ACTION_STAGES.has(lead.stage)) rankScore += 18;
      if (lead.stage === "documents_pending" || lead.stage === "payment_pending") rankScore += 10;
      if (overdueFollowups.length > 0) rankScore += 28 + Math.min(12, overdueFollowups.length * 4);
      else if (nextFollowup) {
        const due = parseDate(nextFollowup.due_date);
        if (due) {
          const diff = daysBetween(due, now);
          if (diff <= 0) rankScore += 16;
          else if (diff <= 2) rankScore += 14;
          else if (diff <= 7) rankScore += 8;
        }
      }

      if (daysSinceTouch > 21) rankScore += 18;
      else if (daysSinceTouch > 14) rankScore += 14;
      else if (daysSinceTouch > 7) rankScore += 10;
      else if (daysSinceTouch <= 1) rankScore += 4;

      if (!lead.email && !lead.phone && !lead.whatsapp) rankScore += 8;
      if (!lead.notes) rankScore += 2;
      if (!lead.service_id) rankScore += 4;

      const reasons: string[] = [];
      reasons.push(`stale for ${daysSinceTouch} day${daysSinceTouch === 1 ? "" : "s"}`);
      const followupReason = overdueFollowups.length
        ? `${overdueFollowups.length} overdue follow-up${overdueFollowups.length === 1 ? "" : "s"}`
        : nextFollowup
          ? `next follow-up due in ${Math.max(0, daysBetween(parseDate(nextFollowup.due_date) ?? now, now))} day${Math.max(0, daysBetween(parseDate(nextFollowup.due_date) ?? now, now)) === 1 ? "" : "s"}`
          : "no scheduled follow-up";
      reasons.push(followupReason);
      if (ACTION_STAGES.has(lead.stage)) reasons.push(`already in ${stageLabel(lead.stage).toLowerCase()} stage`);
      else reasons.push(`stage is ${stageLabel(lead.stage).toLowerCase()}`);
      if (lead.priority === "urgent" || lead.priority === "high") reasons.push(`${lead.priority} priority`);
      if (serviceRollup) reasons.push(`service ${serviceRank.get(lead.service_id as string) === 0 ? "is a top priority" : `ranks #${(serviceRank.get(lead.service_id as string) ?? 0) + 1} of ${serviceRollups.size}`}`);
      if (sourceRollup) reasons.push(`source ${sourceRank.get(lead.source as string) === 0 ? "is a top priority" : `ranks #${(sourceRank.get(lead.source as string) ?? 0) + 1} of ${sourceRollups.size}`}`);
      if (!lead.email && !lead.phone && !lead.whatsapp) reasons.push("missing contact details");
      if (!lead.service_id) reasons.push("service not assigned");

      const next = pickNextStep(lead.stage, Boolean(lead.whatsapp), Boolean(lead.phone), Boolean(lead.email));
      const timing = overdueFollowups.length
        ? "today"
        : nextFollowup
          ? parseDate(nextFollowup.due_date) && daysBetween(parseDate(nextFollowup.due_date) as Date, now) <= 2
            ? "within 24 hours"
            : next.timing
          : next.timing;

      return {
        id: lead.id,
        name: lead.full_name,
        stage: lead.stage,
        priority: lead.priority,
        service: lead.services?.name ?? null,
        source: lead.source ?? null,
        score,
        rankScore,
        reason: reasons.slice(0, 3).join(" • "),
        nextStep: next.nextStep,
        timing,
        channel: next.channel,
        lastTouchedAt: lastActivityAt.toISOString(),
        staleDays: daysSinceTouch,
        followUpDueAt: nextFollowup?.due_date ?? null,
        followUpStatus: overdueFollowups.length
          ? "overdue"
          : nextFollowup
            ? "scheduled"
            : "none",
        servicePriority,
        sourcePriority,
      } satisfies DashboardLeadRecommendation;
    })
    .sort((a, b) => b.rankScore - a.rankScore || new Date(b.lastTouchedAt).getTime() - new Date(a.lastTouchedAt).getTime())
    .slice(0, 15);

  const topLead = topLeads[0];
  const overdueUrgency = input.overdueFollowups;
  const staleLeads = topLeads.filter((lead) => daysBetween(now, parseDate(lead.lastTouchedAt) ?? now) > 14).length;
  const hotCount = topLeads.filter((lead) => lead.score >= 7).length;
  const stageBottleneck = [...input.stageData]
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  const serviceBottleneck = [...input.serviceData]
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  const headline = overdueUrgency > 0
    ? `${overdueUrgency} follow-up${overdueUrgency === 1 ? "" : "s"} need attention now`
    : staleLeads > 0
      ? `${staleLeads} lead${staleLeads === 1 ? "" : "s"} are going stale`
      : "Top opportunities are ready to move";

  const summary = topLead
    ? `This view ranks the 15 most important open leads using stage, priority, follow-up status, and recent activity. Prioritize the leads with overdue or near-due follow-ups first, then work through the hottest active opportunities while they are still warm.`
    : "There are no open leads to prioritize yet. Add leads, create follow-ups, and the dashboard will rank the next best actions automatically.";

  const focusAreas = [
    overdueUrgency > 0 ? `${overdueUrgency} overdue follow-up${overdueUrgency === 1 ? "" : "s"}` : "No overdue follow-ups",
    stageBottleneck ? `${stageBottleneck.stage} has the most leads (${stageBottleneck.count})` : "No clear stage bottleneck",
    serviceBottleneck ? `${serviceBottleneck.name} has the biggest service load (${serviceBottleneck.value})` : "Service mix is balanced",
  ];

  const hotLeads = topLeads.filter((lead) => lead.score >= 7).slice(0, 5);

  const nextActions = topLead
    ? [
        {
          title: `Work ${topLead.name}`,
          reason: `${topLead.reason}. ${topLead.nextStep}`,
          timing: topLead.timing,
          priority: topLead.priority === "urgent" ? "high" : topLead.priority === "high" ? "high" : "medium",
          lead: topLead.name,
        },
        {
          title: `Clear overdue follow-ups`,
          reason: "Older follow-ups should be handled before they cool the pipeline further.",
          timing: "today",
          priority: overdueUrgency > 0 ? "high" : "medium",
          lead: topLead.name,
        },
        {
          title: `Review the ${serviceBottleneck?.name ?? "busiest"} service`,
          reason: "That service carries the most active leads, so improving it will impact the pipeline fastest.",
          timing: "this week",
          priority: "medium",
          lead: null,
        },
      ]
    : [];

  const risks = [
    overdueUrgency > 0
      ? `${overdueUrgency} overdue follow-up${overdueUrgency === 1 ? "" : "s"} may be slowing down deals.`
      : "No overdue follow-ups are visible right now.",
    staleLeads > 0
      ? `${staleLeads} lead${staleLeads === 1 ? "" : "s"} have gone quiet and should be reactivated.`
      : "The top leads are still relatively fresh.",
    hotCount > 0
      ? `${hotCount} lead${hotCount === 1 ? " is" : "s are"} scoring as hot opportunities.`
      : "There are no clearly hot leads in the current top 15.",
  ];

  return {
    headline,
    summary,
    focusAreas,
    nextActions,
    risks,
    topLeads,
    hotLeads,
  };
}
