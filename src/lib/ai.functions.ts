import { createServerFn } from "@tanstack/react-start";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function groqChat(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured in .env");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices[0].message.content;
}

type AskAIInput = { message: string };

export const askAI = createServerFn({ method: "POST" })
  .inputValidator((d: AskAIInput) => d)
  .handler(async ({ data }) =>
    groqChat(
      `You are a helpful AI assistant for OneGrasp CRM — an internal lead management and sales tool.
Help sales teams with lead strategies, follow-up advice, pipeline insights, and general CRM questions.
Be concise, practical, and actionable. Use bullet points when listing multiple items.`,
      data.message,
    ),
  );

type SummarizeLeadInput = {
  name: string;
  stage: string;
  priority: string;
  source?: string | null;
  service?: string | null;
  notes?: string | null;
  activities: string[];
  followups: string[];
};

export const summarizeLead = createServerFn({ method: "POST" })
  .inputValidator((d: SummarizeLeadInput) => d)
  .handler(async ({ data }) => {
    const ctx = `Lead Name: ${data.name}
Pipeline Stage: ${data.stage}
Priority: ${data.priority}
Service: ${data.service ?? "Not assigned"}
Lead Source: ${data.source ?? "Unknown"}
Notes: ${data.notes || "None"}

Recent Activities:
${data.activities.length ? data.activities.slice(0, 5).map((a: string) => `• ${a}`).join("\n") : "No activities recorded yet"}

Scheduled Follow-ups:
${data.followups.length ? data.followups.slice(0, 3).map((f: string) => `• ${f}`).join("\n") : "No follow-ups scheduled"}`;

    return groqChat(
      `You are a CRM AI assistant. Analyze this lead profile and provide a structured response with exactly three sections:

**Status Summary** (2 sentences max)
**Key Observations** (2–3 bullet points)
**Recommended Next Action** (1 specific action)

Be concise and sales-focused.`,
      ctx,
    );
  });

type DraftWhatsAppInput = {
  name: string;
  stage: string;
  service?: string | null;
  lastActivity?: string | null;
};

export const draftWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((d: DraftWhatsAppInput) => d)
  .handler(async ({ data }) => {
    const firstName = data.name.split(" ")[0];
    return groqChat(
      `You are writing a short, friendly WhatsApp follow-up message on behalf of a sales rep at OneGrasp.
Rules: casual tone, first-name only, 2 sentences max, end with a simple question or CTA.
No emojis unless natural. No subject line. No sign-off block. Just the message text.`,
      `Lead first name: ${firstName}
Stage: ${data.stage}
Service: ${data.service ?? "general inquiry"}
Last contact: ${data.lastActivity ?? "none recorded"}`,
    );
  });

type DraftEmailInput = {
  name: string;
  email: string;
  stage: string;
  service?: string | null;
  notes?: string | null;
  lastActivity?: string | null;
};

export const draftFollowUpEmail = createServerFn({ method: "POST" })
  .inputValidator((d: DraftEmailInput) => d)
  .handler(async ({ data }) => {
    const ctx = `Lead name: ${data.name}
Email: ${data.email}
Stage: ${data.stage}
Service interest: ${data.service ?? "Not specified"}
Notes: ${data.notes || "None"}
Last activity: ${data.lastActivity ?? "None"}`;

    const raw = await groqChat(
      `You are a professional B2B sales email writer.
Write a short, warm follow-up email for this lead.
Return ONLY valid JSON — no markdown, no explanation:
{"subject":"subject line max 60 chars","body":"email body text"}

Rules:
- Use the lead's actual first name in the greeting (extract from full name)
- Reference their service interest if available
- 3 short paragraphs max, conversational but professional
- End with one clear call-to-action (reply, book a call, etc.)
- Keep body under 130 words
- Sign off: "Warm regards,\\nThe OneGrasp Team"
- No placeholder brackets like [Name] or [Company]`,
      ctx,
    );

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return valid JSON");
    return JSON.parse(match[0]) as { subject: string; body: string };
  });

type ParseLeadsInput = { text: string };

export const parseLeadsFromText = createServerFn({ method: "POST" })
  .inputValidator((d: ParseLeadsInput) => d)
  .handler(async ({ data }) => {
    const truncated = data.text.slice(0, 12000);
    const raw = await groqChat(
      `You are a data extraction assistant for a CRM. Extract every lead/contact from the text.
Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Each object must have exactly these keys (use null when missing):
full_name (string, required — omit objects without a name), email (string|null),
phone (string|null), whatsapp (string|null), city (string|null), country (string|null),
source (string|null), notes (string|null)
Example output: [{"full_name":"Jane Doe","email":"jane@co.com","phone":"+971501234567","whatsapp":null,"city":"Dubai","country":"UAE","source":null,"notes":null}]`,
      truncated,
    );
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("AI could not find structured lead data in this file");
    return JSON.parse(match[0]) as Array<Record<string, string | null>>;
  });

type SuggestNextActionInput = {
  name: string;
  stage: string;
  priority: string;
  service?: string | null;
  lastActivity?: string | null;
  notes?: string | null;
};

export const suggestNextAction = createServerFn({ method: "POST" })
  .inputValidator((d: SuggestNextActionInput) => d)
  .handler(async ({ data }) => {
    const ctx = `Lead: ${data.name}
Current Stage: ${data.stage}
Priority: ${data.priority}
Service: ${data.service ?? "N/A"}
Last Activity: ${data.lastActivity ?? "None recorded"}
Notes: ${data.notes || "None"}`;

    return groqChat(
      `You are a sales coach. Based on this CRM lead, provide:

**Action** — one specific thing to do right now
**Timing** — when to do it (e.g., "within 24 hours", "next Monday morning")
**Message Template** — a 2–3 sentence script or message to use

Keep it practical and brief.`,
      ctx,
    );
  });
