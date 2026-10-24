/**
 * POST /api/webhook-google
 * Google Ads Lead Form Extensions webhook.
 */
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const MAX_BODY_BYTES = 32 * 1024;

const columnSchema = z.object({
  column_id: z.string().min(1).max(120),
  string_value: z.string().max(500).optional().default(""),
});

const googlePayloadSchema = z.object({
  google_key: z.string().min(1).max(256),
  lead_id: z.string().max(120).optional(),
  campaign_id: z.string().max(120).optional(),
  form_id: z.string().max(120).optional(),
  google_click_id: z.string().max(120).optional(),
  user_column_data: z.array(columnSchema).max(120).default([]),
});

let admin: ReturnType<typeof createClient> | null = null;
function db() {
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const contentLength = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error("Payload too large");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  const correlationId = crypto.randomUUID();
  const expectedKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;

  if (!expectedKey) {
    console.error(`[webhook-google] correlation_id=${correlationId} missing GOOGLE_ADS_WEBHOOK_KEY`);
    send(res, 503, { error: "Webhook is not configured", correlation_id: correlationId });
    return;
  }

  try {
    const payload = googlePayloadSchema.parse(await readBody(req));

    if (!safeEqual(payload.google_key, expectedKey)) {
      send(res, 401, { error: "Unauthorized" });
      return;
    }

    const cols: Record<string, string> = {};
    for (const item of payload.user_column_data) cols[item.column_id] = item.string_value ?? "";

    const fullName = cols.FULL_NAME || `${cols.FIRST_NAME ?? ""} ${cols.LAST_NAME ?? ""}`.trim();
    if (!fullName) {
      send(res, 400, { error: "Invalid payload" });
      return;
    }

    if (payload.lead_id) {
      const { data: existing } = await db()
        .from("webhook_inbox")
        .select("lead_id")
        .eq("provider", "google")
        .eq("external_id", payload.lead_id)
        .maybeSingle<{ lead_id: string | null }>();

      if (existing?.lead_id) {
        send(res, 200, { success: true, idempotent: true, lead_id: existing.lead_id });
        return;
      }

      await db().from("webhook_inbox").upsert(
        {
          provider: "google",
          external_id: payload.lead_id,
          payload,
          status: "processing",
        },
        { onConflict: "provider,external_id" },
      );
    }

    const { data: inserted, error } = await db()
      .from("leads")
      .insert({
        full_name: fullName,
        email: cols.EMAIL || null,
        phone: cols.PHONE_NUMBER || null,
        city: cols.CITY || null,
        country: cols.COUNTRY || null,
        stage: "new",
        priority: "medium",
        source: "Google Ads",
        custom_data: {
          campaign_id: payload.campaign_id ?? null,
          form_id: payload.form_id ?? null,
          google_click_id: payload.google_click_id ?? null,
          google_lead_id: payload.lead_id ?? null,
          webhook_source: "google_ads",
        },
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !inserted) throw error ?? new Error("Lead insertion failed");

    if (payload.lead_id) {
      await db()
        .from("webhook_inbox")
        .update({ lead_id: inserted.id, status: "processed", processed_at: new Date().toISOString() })
        .eq("provider", "google")
        .eq("external_id", payload.lead_id);
    }

    send(res, 200, { success: true, lead_id: inserted.id });
  } catch (error) {
    console.error(`[webhook-google] correlation_id=${correlationId}`, error);
    send(res, 400, { error: "Request could not be processed", correlation_id: correlationId });
  }
}
