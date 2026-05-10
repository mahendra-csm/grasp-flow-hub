import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type UserIdInput = { userId: string };

export const generateWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    const clean = data.userId.replace(/-/g, "");
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const key = `ogk_live_${clean}_${rand}`;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { webhook_api_key: key },
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const getWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !user.user) return { key: null as string | null };
    return { key: (user.user.user_metadata?.webhook_api_key as string) ?? null };
  });

export const revokeWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { webhook_api_key: null },
    });
    return { ok: true };
  });
