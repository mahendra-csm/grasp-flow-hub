import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  logSecurityEvent,
  makeCorrelationId,
  requireAuthenticatedActor,
} from "@/lib/server-security";

const optionalUserSchema = z
  .object({
    userId: z.string().uuid().optional(),
  })
  .optional()
  .default({});

function hashWebhookKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createWebhookKey() {
  return `ogk_live_${randomBytes(24).toString("hex")}`;
}

async function resolveTargetUserId(requestedUserId: string | undefined) {
  const actor = await requireAuthenticatedActor();
  const targetUserId = requestedUserId ?? actor.id;

  if (targetUserId !== actor.id && !actor.isAdmin) {
    throw new Error("Forbidden");
  }

  return { actor, targetUserId };
}

export const generateWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => optionalUserSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();

    try {
      const { actor, targetUserId } = await resolveTargetUserId(data.userId);
      const key = createWebhookKey();
      const keyHash = hashWebhookKey(key);
      const keyPrefix = key.slice(0, 16);

      const { error } = await supabaseAdmin.from("webhook_keys").upsert(
        {
          user_id: targetUserId,
          api_key_hash: keyHash,
          key_prefix: keyPrefix,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      return { key, keyPrefix };
    } catch (error) {
      logSecurityEvent("webhook-key-generate", correlationId, error);
      throw new Error(`Unable to generate webhook key. correlation_id=${correlationId}`);
    }
  });

export const getWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => optionalUserSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();

    try {
      const { targetUserId } = await resolveTargetUserId(data.userId);

      const { data: row, error } = await supabaseAdmin
        .from("webhook_keys")
        .select("user_id,key_prefix")
        .eq("user_id", targetUserId)
        .maybeSingle<{ user_id: string; key_prefix: string | null }>();

      if (error) throw error;

      return {
        hasKey: !!row,
        keyPrefix: row?.key_prefix ?? null,
      };
    } catch (error) {
      logSecurityEvent("webhook-key-get", correlationId, error);
      throw new Error(`Unable to read webhook key details. correlation_id=${correlationId}`);
    }
  });

export const revokeWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => optionalUserSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();

    try {
      const { actor, targetUserId } = await resolveTargetUserId(data.userId);
      const { error } = await supabaseAdmin.from("webhook_keys").delete().eq("user_id", targetUserId);
      if (error) throw error;

      logSecurityEvent("webhook-key-revoke", correlationId, {
        actor_id: actor.id,
        target_user_id: targetUserId,
      });

      return { ok: true };
    } catch (error) {
      logSecurityEvent("webhook-key-revoke", correlationId, error);
      throw new Error(`Unable to revoke webhook key. correlation_id=${correlationId}`);
    }
  });
