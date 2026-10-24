import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const ALLOWED_ORIGINS = new Set(["https://onegrasp.com", "https://www.onegrasp.com"]);
export const WEBHOOK_LEADS_MAX_BODY_BYTES = 32 * 1024;
const MAX_CUSTOM_DATA_KEYS = 50;
const MAX_CUSTOM_DATA_VALUE_LENGTH = 500;

export const webhookLeadPayloadSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  source: z.string().trim().max(120).optional(),
  service: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  message: z.string().trim().max(2000).optional(),
  external_id: z.string().trim().max(120).optional(),
  utm_source: z.string().trim().max(120).optional(),
  utm_medium: z.string().trim().max(120).optional(),
  utm_campaign: z.string().trim().max(120).optional(),
  utm_content: z.string().trim().max(120).optional(),
  utm_term: z.string().trim().max(120).optional(),
  custom_data: z.record(z.unknown()).optional(),
});

let admin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (admin) return admin;

  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Webhook backend is not configured");
  }

  admin = createClient(url, serviceRole, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  return admin;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://onegrasp.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function readJsonWithLimit(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > WEBHOOK_LEADS_MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > WEBHOOK_LEADS_MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  return JSON.parse(text) as unknown;
}

function sanitizeCustomData(customData: Record<string, unknown> | undefined) {
  if (!customData) return {} as Record<string, unknown>;

  const entries = Object.entries(customData)
    .slice(0, MAX_CUSTOM_DATA_KEYS)
    .map(([key, value]) => {
      const normalizedKey = key.slice(0, 64);
      if (typeof value === "string") {
        return [normalizedKey, value.slice(0, MAX_CUSTOM_DATA_VALUE_LENGTH)] as const;
      }
      return [normalizedKey, value] as const;
    });

  return Object.fromEntries(entries);
}

async function resolveServiceId(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const { data } = await getSupabaseAdmin()
    .from("services")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

export async function handleWebhookLeads(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const correlationId = crypto.randomUUID();

  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    const webhookKey = authorization.slice(7).trim();
    if (!webhookKey) return json({ error: "Unauthorized" }, 401, cors);

    const keyHash = await hashKey(webhookKey);
    const { data: keyRow, error: keyError } = await getSupabaseAdmin()
      .from("webhook_keys")
      .select("user_id")
      .eq("api_key_hash", keyHash)
      .maybeSingle<{ user_id: string }>();

    if (keyError || !keyRow) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    const payload = webhookLeadPayloadSchema.parse(await readJsonWithLimit(request));
    const passthrough = sanitizeCustomData(payload.custom_data);
    const serviceId = await resolveServiceId(payload.service);

    const externalId = payload.external_id ?? (typeof passthrough.external_id === "string" ? passthrough.external_id : null);

    if (externalId) {
      const { data: existing } = await getSupabaseAdmin()
        .from("webhook_inbox")
        .select("lead_id")
        .eq("provider", "website")
        .eq("external_id", externalId)
        .maybeSingle<{ lead_id: string | null }>();

      if (existing?.lead_id) {
        return json({ ok: true, idempotent: true, lead_id: existing.lead_id }, 200, cors);
      }

      await getSupabaseAdmin().from("webhook_inbox").upsert(
        {
          provider: "website",
          external_id: externalId,
          payload,
          status: "processing",
        },
        { onConflict: "provider,external_id" },
      );
    }

    const source = [payload.source || "Website", payload.utm_campaign].filter(Boolean).join(" — ").slice(0, 120);

    const customData: Record<string, unknown> = {
      ...passthrough,
      utm_source: payload.utm_source ?? passthrough.utm_source ?? null,
      utm_medium: payload.utm_medium ?? passthrough.utm_medium ?? null,
      utm_campaign: payload.utm_campaign ?? passthrough.utm_campaign ?? null,
      utm_content: payload.utm_content ?? passthrough.utm_content ?? null,
      utm_term: payload.utm_term ?? passthrough.utm_term ?? null,
      webhook_source: "website",
    };

    if (payload.service) {
      customData.service_requested = payload.service;
      if (!serviceId) customData.service_unmatched = true;
    }

    const { data: lead, error: insertError } = await getSupabaseAdmin()
      .from("leads")
      .insert({
        full_name: payload.full_name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        whatsapp: payload.whatsapp ?? null,
        city: payload.city ?? null,
        country: payload.country ?? null,
        source,
        service_id: serviceId,
        notes: payload.notes || payload.message || null,
        stage: "new",
        priority: "medium",
        custom_data: customData,
        created_by: keyRow.user_id,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !lead) throw insertError ?? new Error("Failed to insert lead");

    if (externalId) {
      await getSupabaseAdmin()
        .from("webhook_inbox")
        .update({ lead_id: lead.id, status: "processed", processed_at: new Date().toISOString() })
        .eq("provider", "website")
        .eq("external_id", externalId);
    }

    return json({ ok: true, lead_id: lead.id, service_id: serviceId }, 201, cors);
  } catch (error) {
    console.error(`[webhook-leads] correlation_id=${correlationId}`, error);
    return json({ error: "Request could not be processed", correlation_id: correlationId }, 400, cors);
  }
}
