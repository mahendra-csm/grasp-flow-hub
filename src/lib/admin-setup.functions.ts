import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "support@onegrasp.com";
const ADMIN_PASSWORD = "onegrasp@2026";

export const ensureAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) return { ok: false, error: listErr.message };

  const exists = list.users.some((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (exists) return { ok: true, created: false };

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "OneGrasp Admin", role: "admin" },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: true };
});
