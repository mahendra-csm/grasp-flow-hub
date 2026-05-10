export type LeadScore = {
  score: number;   // 1–10
  label: string;
  badgeClass: string;
};

const STAGE_POINTS: Record<string, number> = {
  lost: 0, new: 5, contacted: 12, interested: 22,
  follow_up: 28, documents_pending: 33, payment_pending: 38,
  converted: 40, closed: 35,
};

const PRIORITY_POINTS: Record<string, number> = {
  low: 5, medium: 12, high: 20, urgent: 25,
};

function activityPoints(lastAt?: string | null): number {
  if (!lastAt) return 0;
  const days = (Date.now() - new Date(lastAt).getTime()) / 86_400_000;
  if (days < 1) return 20;
  if (days < 3) return 15;
  if (days < 7) return 10;
  if (days < 30) return 5;
  return 2;
}

export function scoreLead(input: {
  stage: string;
  priority: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  lastActivityAt?: string | null;
}): LeadScore {
  const total =
    (STAGE_POINTS[input.stage] ?? 5) +
    (PRIORITY_POINTS[input.priority] ?? 5) +
    (input.email ? 5 : 0) +
    (input.phone ? 5 : 0) +
    (input.whatsapp ? 5 : 0) +
    activityPoints(input.lastActivityAt);

  // max possible = 40+25+15+20 = 100 → scale to 1–10
  const score = Math.max(1, Math.min(10, Math.round(total / 10)));

  if (score <= 3) return { score, label: "Cold",    badgeClass: "bg-muted text-muted-foreground border-border" };
  if (score <= 5) return { score, label: "Warm",    badgeClass: "bg-info/10 text-info border-info/20" };
  if (score <= 7) return { score, label: "Hot",     badgeClass: "bg-warning/15 text-warning-foreground border-warning/20" };
                  return { score, label: "🔥 Hot",  badgeClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400" };
}
