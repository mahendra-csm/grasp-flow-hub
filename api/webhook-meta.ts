/**
 * GET  /api/webhook-meta  — Meta webhook verification handshake
 * POST /api/webhook-meta  — Meta Lead Ads event
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const MAX_BODY_BYTES = 64 * 1024;

const leadgenEventSchema = z.object({
  field: z.literal("leadgen"),
  value: z.object({
    leadgen_id: z.string().min(1).max(120),
    campaign_id: z.string().max(120).optional(),
    ad_id: z.string().max(120).optional(),
    form_id: z.string().max(120).optional(),
  }),
});

const metaPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z.array(leadgenEventSchema).max(100).default([]),
      }),
    )
    .max(100)
    .default([]),
});

let admin: ReturnType<typeof createClient> | null = null;
function db() {
  if (!admin)
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return admin;
}

function send(res: ServerResponse, status: number, data: string | unknown) {
  res.statusCode = status;
  if (typeof data === "string") {
    res.setHeader("content-type", "text/plain");
    res.end(data);
    return;
  }

  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

async function readRawBody(req: IncomingMessage) {
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
  return Buffer.concat(chunks);
}

function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const receivedSignature = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const expectedSignature = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"), "hex");

  if (receivedSignature.length !== expectedSignature.length) return false;
  return timingSafeEqual(receivedSignature, expectedSignature);
}

type PendingEvent = {
  leadgen_id: string;
  campaign_id?: string;
  ad_id?: string;
  form_id?: string;
};

async function processMetaEvents(events: PendingEvent[], pageToken: string, correlationId: string) {
  for (const event of events) {
    try {
      const { data: inbox } = await db()
        .from("webhook_inbox")
        .select("lead_id,status")
        .eq("provider", "meta")
        .eq("external_id", event.leadgen_id)
        .maybeSingle<{ lead_id: string | null; status: string | null }>();

      if (inbox?.lead_id) continue;

      const response = await fetch(
        `https://graph.facebook.com/v20.0/${event.leadgen_id}?access_token=${encodeURIComponent(pageToken)}`,
      );
      if (!response.ok) throw new Error(`Meta API ${response.status}`);

      const lead = (await response.json()) as {
        field_data?: Array<{ name: string; values?: string[] }>;
      };

      const fields: Record<string, string> = {};
      for (const item of lead.field_data ?? []) {
        fields[String(item.name)] = String(item.values?.[0] ?? "").slice(0, 500);
      }

      const fullName =
        fields.full_name || `${fields.first_name ?? ""} ${fields.last_name ?? ""}`.trim();
      if (!fullName) throw new Error("Missing lead name");

      const { data: inserted, error: insertError } = await db()
        .from("leads")
        .insert({
          full_name: fullName,
          email: fields.email || null,
          phone: fields.phone_number || null,
          city: fields.city || null,
          country: fields.country || null,
          stage: "new",
          priority: "medium",
          source: "Meta Ads",
          custom_data: {
            campaign_id: event.campaign_id ?? null,
            ad_id: event.ad_id ?? null,
            form_id: event.form_id ?? null,
            leadgen_id: event.leadgen_id,
            webhook_source: "meta_ads",
          },
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !inserted) throw insertError ?? new Error("Lead insertion failed");

      await db()
        .from("webhook_inbox")
        .update({ status: "processed", lead_id: inserted.id, processed_at: new Date().toISOString() })
        .eq("provider", "meta")
        .eq("external_id", event.leadgen_id);
    } catch (error) {
      console.error(`[meta-webhook] correlation_id=${correlationId} processing error`, error);
      await db()
        .from("webhook_inbox")
        .update({
          status: "failed",
          error_message: String(error instanceof Error ? error.message : error).slice(0, 500),
        })
        .eq("provider", "meta")
        .eq("external_id", event.leadgen_id);
    }
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const correlationId = crypto.randomUUID();
  const url = new URL(req.url ?? "/", "https://placeholder.invalid");

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN && challenge) {
      send(res, 200, challenge);
    } else {
      send(res, 403, "Verification failed");
    }
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  const appSecret = process.env.META_APP_SECRET;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!appSecret || !pageToken) {
    console.error(`[meta-webhook] correlation_id=${correlationId} missing environment configuration`);
    send(res, 503, { error: "Webhook is not configured", correlation_id: correlationId });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signatureHeader = req.headers["x-hub-signature-256"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
      send(res, 401, { error: "Unauthorized" });
      return;
    }

    const payload = metaPayloadSchema.parse(JSON.parse(rawBody.toString("utf8")));
    const pendingEvents: PendingEvent[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const leadgenId = change.value.leadgen_id;

        const { data: existing } = await db()
          .from("webhook_inbox")
          .select("external_id")
          .eq("provider", "meta")
          .eq("external_id", leadgenId)
          .maybeSingle<{ external_id: string }>();

        if (!existing) {
          await db().from("webhook_inbox").insert({
            provider: "meta",
            external_id: leadgenId,
            payload: change.value,
            status: "processing",
          });
        }

        pendingEvents.push(change.value);
      }
    }

    send(res, 200, { received: true });

    setImmediate(() => {
      void processMetaEvents(pendingEvents, pageToken, correlationId);
    });
  } catch (error) {
    console.error(`[meta-webhook] correlation_id=${correlationId}`, error);
    send(res, 400, { error: "Request could not be processed", correlation_id: correlationId });
  }
}
