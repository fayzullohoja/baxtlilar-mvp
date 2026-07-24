import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAdminSettings } from "@/lib/admin/settings";
import { loadFeatureFlags } from "@/lib/features/flags";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { SettingsForm } from "./SettingsForm";
import { FeatureFlagsPanel } from "./FeatureFlagsPanel";

export const dynamic = "force-dynamic";

// Волна 7 Фаза 3: системные настройки. settings.edit (super).
export default async function SettingsPage() {
  const session = await requireAdmin();
  if (!can(session.role, "settings.edit")) notFound();

  const { data: me } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const settings = await loadAdminSettings();
  const flags = await loadFeatureFlags();

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Настройки</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Баннер-объявление виден всем админам вверху панели. Порог SLA подсвечивает
        «старейший кейс» на дашборде. Kill switches мгновенно выключают функции для
        всех пользователей без деплоя.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
        <SettingsForm initial={settings} />
        <FeatureFlagsPanel initial={flags} />
      </div>
    </OpsShell>
  );
}
