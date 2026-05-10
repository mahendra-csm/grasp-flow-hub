/**
 * POST /api/webhook-google
 * Google Ads Lead Form Extensions webhook.
 * Set GOOGLE_ADS_WEBHOOK_KEY in Vercel to the key configured in Google Ads.
 * Docs: https://support.google.com/google-ads/answer/12015596
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

let admin: ReturnType<typeof createClient> | null = null;
function db() {
  if (!admin)
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return admin;
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req as AsyncIterable<Buffer>) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") { send(res, 405, { error: "POST only" }); return; }

  let b: any;
  try { b = await body(req); } catch { send(res, 400, { error: "Invalid JSON" }); return; }

  // Validate Google key if configured
  const expectedKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;
  if (expectedKey && b.google_key !== expectedKey) {
    send(res, 401, { error: "Invalid google_key" });
    return;
  }

  // Map Google's column_id format to fields
  const cols: Record<string, string> = {};
  for (const col of b.user_column_data ?? []) {
    cols[col.column_id as string] = col.string_value as string;
  }

  const fullName =
    cols["FULL_NAME"] ||
    `${cols["FIRST_NAME"] ?? ""} ${cols["LAST_NAME"] ?? ""}`.trim() ||
    null;

  if (!fullName) { send(res, 400, { error: "No name in lead data" }); return; }

  const { data, error } = await db()
    .from("leads")
    .insert({
      full_name: fullName,
      email: cols["EMAIL"] || null,
      phone: cols["PHONE_NUMBER"] || null,
      city: cols["CITY"] || null,
      country: cols["COUNTRY"] || null,
      stage: "new",
      priority: "medium",
      source: "Google Ads",
      custom_data: {
        campaign_id: b.campaign_id ?? null,
        form_id: b.form_id ?? null,
        google_click_id: b.google_click_id ?? null,
        google_lead_id: b.lead_id ?? null,
        webhook_source: "google_ads",
      },
    })
    .select("id")
    .single();

  if (error) { send(res, 500, { error: error.message }); return; }
  send(res, 200, { success: true, lead_id: data.id });
}
