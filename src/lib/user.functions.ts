import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CreateUserInput = { email: string; password: string; role?: string };

function validateEmail(e: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((d: CreateUserInput) => d)
  .handler(async ({ data }) => {
    // Basic input validation to avoid common errors
    if (!data?.email || !data?.password) throw new Error("Email and password are required");
    if (!validateEmail(data.email)) throw new Error("Invalid email address");
    if (String(data.password).length < 8) throw new Error("Password must be at least 8 characters");

    const role = data.role ?? "employee";

    try {
      // quick validation: ensure service-role key works by listing one user
      try {
        // this call will fail fast if the service role key is missing/invalid
        // listUsers requires admin privileges
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: listErr } = await (supabaseAdmin as any).auth.admin.listUsers({ perPage: 1, page: 1 });
        if (listErr) {
          const msg = String(listErr.message ?? listErr).toLowerCase();
          if (msg.includes("invalid") || msg.includes("not authorized") || msg.includes("permission")) {
            throw new Error(
              "Supabase service role key is missing or invalid. Set SUPABASE_SERVICE_ROLE_KEY in your .env with a valid service role key and restart the dev server.",
            );
          }
        }
      } catch (e: any) {
        // bubble up the friendly message if we created one, otherwise continue to actual creation
        if (e?.message?.includes("service role key")) throw e;
      }

      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { role, name: data.email },
      });
      if (error) {
        // Provide a clear error message without leaking internals
        throw new Error(error.message || "Failed to create user");
      }
      return { ok: true };
    } catch (err: any) {
      // Log server-side error for debugging (keeps response safe)
      console.error("createUser error:", err?.message ?? err);
      throw new Error(err?.message ?? "Failed to create user");
    }
  });
