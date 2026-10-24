import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logSecurityEvent, makeCorrelationId } from "@/lib/server-security";

const bootstrapSchema = z.object({
  token: z.string().min(32).max(256),
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bootstrapSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();
    const enabled = process.env.ADMIN_BOOTSTRAP_ENABLED === "true";
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

    if (!enabled || !expectedToken || !bootstrapEmail || !bootstrapPassword) {
      throw new Error(`Admin bootstrap is disabled. correlation_id=${correlationId}`);
    }

    if (data.token !== expectedToken) {
      logSecurityEvent("admin-bootstrap", correlationId, { reason: "invalid bootstrap token" });
      throw new Error("Invalid bootstrap request");
    }

    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (listErr) {
      logSecurityEvent("admin-bootstrap", correlationId, listErr.message);
      throw new Error("Admin bootstrap failed");
    }

    const exists = users.users.some((user) => user.email?.toLowerCase() === bootstrapEmail.toLowerCase());
    if (exists) {
      return { ok: true, created: false };
    }

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: bootstrapEmail,
      password: bootstrapPassword,
      email_confirm: true,
      user_metadata: { name: "Bootstrap Admin", role: "admin" },
    });

    if (error) {
      logSecurityEvent("admin-bootstrap", correlationId, error.message);
      throw new Error("Admin bootstrap failed");
    }

    return { ok: true, created: true };
  });
