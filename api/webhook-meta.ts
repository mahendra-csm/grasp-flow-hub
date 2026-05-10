/**
 * GET  /api/webhook-meta  — Meta webhook verification handshake
 * POST /api/webhook-meta  — Meta Lead Ads event (fetches lead from Graph API)
 *
 * Required Vercel env vars:
 *   META_VERIFY_TOKEN       — any secret string; put the same in Meta Events Manager
 *   META_PAGE_ACCESS_TOKEN  — Page access token from Meta Business Suite
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
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

function send(res: ServerResponse, status: number, data: string | unknown) {
  res.statusCode = status;
  if (typeof data === "string") {
    res.setHeader("Content-Type", "text/plain");
    res.end(data);
  } else {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "https://placeholder.invalid");

  // ── Verification handshake ────────────────────────────────────────────────
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

  if (req.method !== "POST") { send(res, 405, { error: "POST only" }); return; }

  let b: any;
  try { b = await body(req); } catch { send(res, 400, { error: "Invalid JSON" }); return; }

  // Respond 200 immediately — Meta expects a quick ack
  send(res, 200, { received: true });

  // Process each leadgen event asynchronously
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageToken) return;

  for (const entry of b.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id, campaign_id, ad_id, form_id } = change.value ?? {};
      if (!leadgen_id) continue;

      try {
        const r = await fetch(
          `https://graph.facebook.com/v20.0/${leadgen_id}?access_token=${pageToken}`
        );
        if (!r.ok) continue;
        const lead: any = await r.json();

        const fields: Record<string, string> = {};
        for (const f of lead.field_data ?? []) {
          fields[String(f.name)] = String(f.values?.[0] ?? "");
        }

        const fullName =
          fields["full_name"] ||
          `${fields["first_name"] ?? ""} ${fields["last_name"] ?? ""}`.trim() ||
          null;

        if (!fullName) continue;

        await db().from("leads").insert({
          full_name: fullName,
          email: fields["email"] || null,
          phone: fields["phone_number"] || null,
          city: fields["city"] || null,
          country: fields["country"] || null,
          stage: "new",
          priority: "medium",
          source: "Meta Ads",
          custom_data: {
            campaign_id: campaign_id ?? null,
            ad_id: ad_id ?? null,
            form_id: form_id ?? null,
            leadgen_id: leadgen_id ?? null,
            webhook_source: "meta_ads",
          },
        });
      } catch (e) {
        console.error("[meta-webhook] lead processing error:", e);
      }
    }
  }
}
