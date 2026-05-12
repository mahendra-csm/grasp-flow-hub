import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = new Set([
  "https://onegrasp.com",
  "https://www.onegrasp.com",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const o = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://onegrasp.com";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function handleWebhookLeads(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  // Verify Bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing Authorization header" }, 401, cors);
  }
  const apiKey = authHeader.slice(7).trim();

  // Look up key owner via SECURITY DEFINER RPC (no service role key needed)
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userId, error: keyErr } = await supabase.rpc("verify_webhook_key" as any, { p_key: apiKey });
  if (keyErr || !userId) {
    return json({ error: "Invalid API key" }, 401, cors);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const full_name = String(body.full_name ?? "").trim();
  if (!full_name) {
    return json({ error: "full_name is required" }, 400, cors);
  }

  // Collect UTM params and extra fields into custom_data
  const custom_data: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "message", "form_name", "page_url"]) {
    if (body[k] && typeof body[k] === "string") custom_data[k] = body[k] as string;
  }

  // Insert lead via SECURITY DEFINER RPC
  const { data: leadId, error: insertErr } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "insert_webhook_lead" as any,
    {
      p_user_id:     userId,
      p_full_name:   full_name,
      p_email:       typeof body.email    === "string" ? body.email    || null : null,
      p_phone:       typeof body.phone    === "string" ? body.phone    || null : null,
      p_whatsapp:    typeof body.whatsapp === "string" ? body.whatsapp || null : null,
      p_source:      typeof body.source   === "string" ? body.source   || "Website" : "Website",
      p_custom_data: custom_data,
    },
  );

  if (insertErr) {
    console.error("[webhook-leads] insert error:", insertErr.message);
    return json({ error: "Failed to save lead" }, 500, cors);
  }

  return json({ ok: true, id: leadId }, 201, cors);
}
