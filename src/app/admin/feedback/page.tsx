import { notFound } from "next/navigation";
import { requireAdmin, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { loadFeedbackRows, FEEDBACK_LIST_LIMIT } from "@/lib/admin/load-feedback";
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

  // SG-09 / KVKK: тем же приёмом, что case_view в /admin/cases/[id] - логируем
  // РАЗРЕШЁННЫЙ просмотр чувствительного материала. Скриншот отзыва по классу
  // равен паспорту, и без этой записи открытие раздела не оставляло следа
  // вообще: расследовать «кто видел чужую переписку» было бы не по чему.
  //
  // В новом значении только счётчик: тексты отзывов, пути скриншотов и список
  // авторов сюда класть нельзя - иначе журнал сам станет копией того, что мы
  // этим журналом и защищаем.
  await adminAudit({
    adminId: session.adminId,
    action: "feedback_list_view",
    entity: "feedback",
    newValue: { count: rows.length },
  });

  return (
    <OpsShell adminName={me?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Отзывы</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Что люди пишут о приложении. Скриншоты открываются по подписанной ссылке
        и живут пять минут, а миниатюры подгружаются по мере прокрутки - если
        вместо миниатюры пустое место или ссылка не открылась, обновите
        страницу.
        {/* Подсказку про потолок показываем, только когда список упёрся в него.
            Формулировка условная: по одному запросу нельзя сказать, есть ли за
            потолком ещё строки, а обещать существование старых отзывов, когда
            их ровно пятьдесят, - то же враньё, что молчать про обрезку. */}
        {rows.length === FEEDBACK_LIST_LIMIT
          ? ` Список выводит не больше ${FEEDBACK_LIST_LIMIT} последних отзывов - если их накопилось больше, старые сюда не попадают.`
          : ""}
      </p>
      {/* Право на карточку клиента считаем здесь, а не в клиентском компоненте:
          роль авторитетна только на сервере (requireAdmin берёт её из БД).
          Сейчас раздел super-only, а у super карточка открыта всегда, так что
          флаг постоянно true - он остаётся страховкой на случай, если право
          когда-нибудь снова расширят на модератора. */}
      <FeedbackList rows={rows} canOpenClient={can(session.role, "clients.directory")} />
    </OpsShell>
  );
}
