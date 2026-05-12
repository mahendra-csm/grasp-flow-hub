import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type UserIdInput = { userId: string };

function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const generateWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: key, error } = await getSupabase().rpc("manage_webhook_key" as any, {
      p_user_id: data.userId,
      p_action: "generate",
    });
    if (error) throw new Error(error.message);
    return { key: key as string };
  });

export const getWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: key } = await getSupabase().rpc("manage_webhook_key" as any, {
      p_user_id: data.userId,
      p_action: "get",
    });
    return { key: (key as string | null) ?? null };
  });

export const revokeWebhookKey = createServerFn({ method: "POST" })
  .inputValidator((d: UserIdInput) => d)
  .handler(async ({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await getSupabase().rpc("manage_webhook_key" as any, {
      p_user_id: data.userId,
      p_action: "revoke",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
