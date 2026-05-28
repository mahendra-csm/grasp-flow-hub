/**
 * POST /api/webhook-leads
 * Website / generic webhook. Requires: Authorization: Bearer <ogk_live_...>
 * Creates a lead with UTM attribution + optional service mapping + custom_data passthrough.
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

async function validateKey(key: string): Promise<boolean> {
  // key format: ogk_live_<userId32hex>_<random36hex>
  const parts = key.split("_");
  if (parts[0] !== "ogk" || parts[1] !== "live" || !parts[2]) return false;
  const raw = parts[2];
  if (raw.length !== 32) return false;
  const userId = [raw.slice(0, 8), raw.slice(8, 12), raw.slice(12, 16), raw.slice(16, 20), raw.slice(20)].join("-");
  const { data, error } = await db().auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return data.user.user_metadata?.webhook_api_key === key;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req as AsyncIterable<Buffer>) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

async function resolveServiceId(name: string | null | undefined): Promise<string | null> {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await db()
    .from("services")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") { send(res, 200, {}); return; }
  if (req.method !== "POST") { send(res, 405, { error: "POST only" }); return; }

  const key = String(req.headers.authorization ?? "").replace("Bearer ", "");
  if (!key || !(await validateKey(key))) {
    send(res, 401, { error: "Invalid or missing API key" });
    return;
  }

  let b: any;
  try { b = await body(req); } catch { send(res, 400, { error: "Invalid JSON" }); return; }

  if (!b.full_name) { send(res, 400, { error: "full_name is required" }); return; }

  const source = [b.source || "Website", b.utm_campaign].filter(Boolean).join(" — ").slice(0, 100);

  const serviceName = typeof b.service === "string" ? b.service : null;
  const serviceId = await resolveServiceId(serviceName);

  const passthrough = (b.custom_data && typeof b.custom_data === "object" && !Array.isArray(b.custom_data))
    ? (b.custom_data as Record<string, unknown>)
    : {};

  const custom_data: Record<string, unknown> = {
    ...passthrough,
    utm_source: b.utm_source ?? passthrough.utm_source ?? null,
    utm_medium: b.utm_medium ?? passthrough.utm_medium ?? null,
    utm_campaign: b.utm_campaign ?? passthrough.utm_campaign ?? null,
    utm_content: b.utm_content ?? passthrough.utm_content ?? null,
    utm_term: b.utm_term ?? passthrough.utm_term ?? null,
    webhook_source: "website",
  };

  if (serviceName) {
    custom_data.service_requested = serviceName;
    if (!serviceId) custom_data.service_unmatched = true;
  }

  const { data, error } = await db()
    .from("leads")
    .insert({
      full_name: String(b.full_name),
      email: b.email ? String(b.email) : null,
      phone: b.phone ? String(b.phone) : null,
      whatsapp: b.whatsapp ? String(b.whatsapp) : null,
      city: b.city ? String(b.city) : null,
      country: b.country ? String(b.country) : null,
      source,
      service_id: serviceId,
      notes: b.notes || b.message ? String(b.notes || b.message) : null,
      stage: "new",
      priority: "medium",
      custom_data,
    })
    .select("id")
    .single();

  if (error) { send(res, 500, { error: error.message }); return; }
  send(res, 201, { success: true, lead_id: data.id, service_id: serviceId });
}
