import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLE_ALLOWLIST = ["admin", "employee"] as const;

const authHeaderSchema = z.string().regex(/^Bearer\s+.+$/i);

export type AuthenticatedActor = {
  id: string;
  email: string | null;
  role: (typeof ROLE_ALLOWLIST)[number];
  isAdmin: boolean;
};

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Authentication is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

function normalizeRole(role: unknown): (typeof ROLE_ALLOWLIST)[number] {
  if (typeof role !== "string") return "employee";
  const normalized = role.toLowerCase();
  if (ROLE_ALLOWLIST.includes(normalized as (typeof ROLE_ALLOWLIST)[number])) {
    return normalized as (typeof ROLE_ALLOWLIST)[number];
  }
  return "employee";
}

export function makeCorrelationId() {
  return crypto.randomUUID();
}

export function logSecurityEvent(scope: string, correlationId: string, details: unknown) {
  console.error(`[${scope}] correlation_id=${correlationId}`, details);
}

export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
  const request = getRequest();
  const headerValue = request?.headers.get("authorization") ?? "";

  if (!authHeaderSchema.safeParse(headerValue).success) {
    throw new Error("Unauthorized");
  }

  const token = headerValue.replace(/^Bearer\s+/i, "").trim();
  const authClient = getSupabaseAuthClient();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string | null }>();

  const profileRole = normalizeRole(profile?.role);
  const metadataRole = normalizeRole(data.user.user_metadata?.role);
  const role = profileRole === "admin" || metadataRole === "admin" ? "admin" : "employee";

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role,
    isAdmin: role === "admin",
  };
}

export async function requireAdminActor(): Promise<AuthenticatedActor> {
  const actor = await requireAuthenticatedActor();
  if (!actor.isAdmin) {
    throw new Error("Forbidden");
  }
  return actor;
}
