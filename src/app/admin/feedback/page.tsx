import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { loadFeedbackRows } from "@/lib/admin/load-feedback";
import { FeedbackList } from "./FeedbackList";

export const dynamic = "force-dynamic";

// Раздел «Отзывы» - единственное место, где видны скриншоты из отзывов: на них
// может оказаться чужая анкета, и наружу они не уходят никуда.
export default async function FeedbackPage() {
  const session = await requireAdmin();
  if (!can(session.role, "feedback.view")) notFound();

  const sb = supabaseAdmin();
  const { data: me } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const rows = await loadFeedbackRows();

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Отзывы</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Что люди пишут о приложении. Скриншот открывается по подписанной ссылке
        и живёт пять минут - если ссылка перестала открываться, обновите
        страницу.
      </p>
      {/* Право на карточку клиента считаем здесь, а не в клиентском компоненте:
          роль авторитетна только на сервере (requireAdmin берёт её из БД). */}
      <FeedbackList rows={rows} canOpenClient={can(session.role, "clients.directory")} />
    </OpsShell>
  );
}
