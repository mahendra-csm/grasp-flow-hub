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
