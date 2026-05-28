export type ConferencePhase = "pre" | "during" | "post";

export type ConferenceChecklistSeed = {
  phase: ConferencePhase;
  title: string;
  description: string;
  sort_order: number;
};

export type ConferenceChecklistItem = ConferenceChecklistSeed & {
  id?: string;
  conference_id: string;
  completed?: boolean;
  completed_at?: string | null;
};

export type Conference = {
  id: string;
  name?: string | null;
  title: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export const conferencePhaseMeta: Record<ConferencePhase, { label: string; shortLabel: string; accent: string; soft: string }> = {
  pre: {
    label: "Before Conference",
    shortLabel: "Pre",
    accent: "text-sky-600",
    soft: "bg-sky-500/10 text-sky-700 border-sky-200",
  },
  during: {
    label: "During Conference",
    shortLabel: "During",
    accent: "text-violet-600",
    soft: "bg-violet-500/10 text-violet-700 border-violet-200",
  },
  post: {
    label: "After Conference",
    shortLabel: "Post",
    accent: "text-emerald-600",
    soft: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  },
};

export const conferenceChecklistSeeds: ConferenceChecklistSeed[] = [
  {
    phase: "pre",
    sort_order: 1,
    title: "Email Marketing",
    description: "Send registration invites, early bird offers, and past-conference highlights.",
  },
  {
    phase: "pre",
    sort_order: 2,
    title: "Poster & Reels Creation (Normal / Keynote / Abstract)",
    description: "Create general promo, keynote speaker feature, and abstract submission CTA creatives.",
  },
  {
    phase: "pre",
    sort_order: 3,
    title: "Running Ad Campaigns",
    description: "Run Meta and Google ads targeted to discipline-specific audiences by country.",
  },
  {
    phase: "pre",
    sort_order: 4,
    title: "Leads Follow-up (WhatsApp / Email / Telegram)",
    description: "Follow up warm leads across WhatsApp, email, and Telegram.",
  },
  {
    phase: "pre",
    sort_order: 5,
    title: "WhatsApp Catalogue (Messages & Reminders & Calls)",
    description: "Manage broadcast lists, status updates, and payment reminders.",
  },
  {
    phase: "pre",
    sort_order: 6,
    title: "Telegram Catalogue (Messages & Reminders & Calls)",
    description: "Handle channel posts, pinned messages, and registration links.",
  },
  {
    phase: "pre",
    sort_order: 7,
    title: "Abstract Review",
    description: "Screen all submitted abstracts for quality and relevance.",
  },
  {
    phase: "pre",
    sort_order: 8,
    title: "Speaker Allocation",
    description: "Confirm speakers, send calendar invites, and collect bios and photos.",
  },
  {
    phase: "pre",
    sort_order: 9,
    title: "Google Meet Setup",
    description: "Create the meeting, set the password, test audio/video, and share the link.",
  },
  {
    phase: "pre",
    sort_order: 10,
    title: "Keynote Speaker Prep (Topic / Profile / PPT)",
    description: "Confirm the topic, collect the bio and photo, and gather the presentation slides.",
  },
  {
    phase: "pre",
    sort_order: 11,
    title: "Script Preparation",
    description: "Write host opening notes, transitions, closing, and Q&A facilitation script.",
  },
  {
    phase: "pre",
    sort_order: 12,
    title: "Readiness: Photos & Videos Capturing",
    description: "Charge devices, test camera and mic, and confirm the recording software.",
  },
  {
    phase: "during",
    sort_order: 1,
    title: "Session Management (Schedule / Speakers / PPT / Q&A)",
    description: "Run the schedule on time, cue speakers, and manage transitions and Q&A.",
  },
  {
    phase: "during",
    sort_order: 2,
    title: "Attendance Tracking (Participants & Committee)",
    description: "Mark attendance in real time and capture the committee member list.",
  },
  {
    phase: "during",
    sort_order: 3,
    title: "Capture Videos & Screenshots",
    description: "Record all sessions and take screenshots for social proof and recap content.",
  },
  {
    phase: "during",
    sort_order: 4,
    title: "YouTube Live",
    description: "Start the stream, monitor chat, and moderate comments.",
  },
  {
    phase: "during",
    sort_order: 5,
    title: "Meeting Restriction (Entry Code Only)",
    description: "Allow only pre-registered participants through a unique entry code.",
  },
  {
    phase: "post",
    sort_order: 1,
    title: "Certificate Readiness",
    description: "Generate and send certificates within 24–48 hours after the event.",
  },
  {
    phase: "post",
    sort_order: 2,
    title: "Conference Report (DOI & Upload to Website)",
    description: "Compile the proceedings, apply for DOI, and upload the report to the website.",
  },
  {
    phase: "post",
    sort_order: 3,
    title: "Screenshots & Videos Upload",
    description: "Edit and upload highlight clips and the photo gallery.",
  },
  {
    phase: "post",
    sort_order: 4,
    title: "Participants Feedback Collection",
    description: "Send the feedback form to attendees and track responses.",
  },
  {
    phase: "post",
    sort_order: 5,
    title: "Video Bytes + Consent (Email Presenters)",
    description: "Request short video testimonials by email and track consent.",
  },
  {
    phase: "post",
    sort_order: 6,
    title: "Marketing Team Coordination – Reel",
    description: "Edit a short highlight reel for social media promotion.",
  },
];

export function buildConferenceChecklistItems(conferenceId: string): ConferenceChecklistItem[] {
  return conferenceChecklistSeeds.map((seed) => ({
    conference_id: conferenceId,
    phase: seed.phase,
    title: seed.title,
    description: seed.description,
    sort_order: seed.sort_order,
    completed: false,
    completed_at: null,
  }));
}

export function phaseItems(items: ConferenceChecklistItem[], phase: ConferencePhase) {
  return items.filter((item) => item.phase === phase).sort((a, b) => a.sort_order - b.sort_order);
}

export function progress(items: ConferenceChecklistItem[]) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
}
