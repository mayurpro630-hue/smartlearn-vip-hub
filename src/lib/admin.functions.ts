import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    if (typeof data?.code !== "string" || data.code.length < 4 || data.code.length > 100) {
      throw new Error("Invalid access code");
    }
    return { code: data.code.trim() };
  })
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected || data.code !== expected) {
      return { ok: false as const, error: "Incorrect admin access code" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) return { ok: false as const, error: "Could not grant admin access" };
    return { ok: true as const };
  });
