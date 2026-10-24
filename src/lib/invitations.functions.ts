import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logSecurityEvent, makeCorrelationId } from "@/lib/server-security";

const redeemInvitationSchema = z.object({
  token: z.string().min(16).max(256),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
});

export const redeemInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => redeemInvitationSchema.parse(input))
  .handler(async ({ data }) => {
    const correlationId = makeCorrelationId();

    try {
      const { data: claim, error: claimError } = await supabaseAdmin.rpc("claim_invitation", {
        p_token: data.token,
        p_email: data.email,
      });

      if (claimError || !claim) {
        throw new Error("Invalid or expired invitation");
      }

      const invitation = claim as { invitation_id: string; role: string; email: string };

      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          role: invitation.role,
          invitation_id: invitation.invitation_id,
        },
      });

      if (createError) {
        await supabaseAdmin.rpc("release_invitation_claim", {
          p_invitation_id: invitation.invitation_id,
        });
        throw createError;
      }

      return { ok: true };
    } catch (error) {
      logSecurityEvent("invitation-redeem", correlationId, error);
      throw new Error(`Unable to redeem invitation. correlation_id=${correlationId}`);
    }
  });
