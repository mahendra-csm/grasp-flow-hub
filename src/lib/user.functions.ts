import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  logSecurityEvent,
  makeCorrelationId,
  requireAdminActor,
} from "@/lib/server-security";

const createUserSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "employee"]).default("employee"),
  name: z.string().trim().min(1).max(120).optional(),
});

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();

    try {
      const actor = await requireAdminActor();

      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          role: data.role,
          name: data.name ?? data.email,
          created_by: actor.id,
        },
      });

      if (error) {
        logSecurityEvent("create-user", correlationId, {
          actor_id: actor.id,
          target_email: data.email,
          message: error.message,
        });
        throw new Error("Failed to create user");
      }

      return { ok: true };
    } catch (error) {
      logSecurityEvent("create-user", correlationId, error);
      throw new Error(`Unable to process user creation request. correlation_id=${correlationId}`);
    }
  });
