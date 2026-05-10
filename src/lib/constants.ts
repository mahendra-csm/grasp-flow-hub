export const PIPELINE_STAGES = [
  { value: "new", label: "New", color: "bg-info/10 text-info border-info/20" },
  { value: "contacted", label: "Contacted", color: "bg-info/10 text-info border-info/20" },
  { value: "interested", label: "Interested", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "follow_up", label: "Follow-Up", color: "bg-warning/10 text-warning-foreground border-warning/20" },
  { value: "documents_pending", label: "Documents Pending", color: "bg-warning/10 text-warning-foreground border-warning/20" },
  { value: "payment_pending", label: "Payment Pending", color: "bg-warning/10 text-warning-foreground border-warning/20" },
  { value: "converted", label: "Converted", color: "bg-success/10 text-success border-success/20" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground border-border" },
  { value: "lost", label: "Lost", color: "bg-destructive/10 text-destructive border-destructive/20" },
] as const;

export type PipelineStageValue = (typeof PIPELINE_STAGES)[number]["value"];

export const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Medium", color: "bg-info/10 text-info" },
  { value: "high", label: "High", color: "bg-warning/15 text-warning-foreground" },
  { value: "urgent", label: "Urgent", color: "bg-destructive/10 text-destructive" },
] as const;

export const LEAD_SOURCES = [
  "Website",
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Referral",
  "Email Campaign",
  "Cold Call",
  "Event",
  "Google Ads",
  "Meta Ads",
  "Other",
] as const;
