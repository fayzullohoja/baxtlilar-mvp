import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TotpSetup } from "@/components/admin-ops/TotpSetup";

export const dynamic = "force-dynamic";

/** SEC-2b — страница включения 2FA. Требует активную admin-сессию. */
export default async function TotpSetupPage() {
  const session = await requireAdmin();
  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login, totp_enrolled_at")
    .eq("id", session.adminId)
    .maybeSingle();

  return (
    <TotpSetup
      login={(admin?.login as string) ?? ""}
      alreadyEnrolled={Boolean(admin?.totp_enrolled_at)}
    />
  );
}
