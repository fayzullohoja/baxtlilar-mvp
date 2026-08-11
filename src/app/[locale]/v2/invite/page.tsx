/**
 * V2 Invite (Task 9, план invite-codes).
 *
 * Экран «Пригласить» - код приглашения крупно, ссылка на бота, счётчик
 * приглашённых. Открывается из настроек (см. Settings.invite_title в
 * SettingsActions.tsx).
 *
 * Данные (код, счётчик, статус верификации) целиком приходят из
 * GET /api/invite (Task 8) - страница их не пересчитывает, чтобы не
 * дублировать бизнес-логику ensureCodeForUser/countInvitedBy. Всей загрузкой
 * и тремя состояниями (код есть / не верифицирован / сбой) занимается
 * клиентский V2InviteScreen - он же даёт кнопку «Повторить» без перезагрузки
 * страницы.
 *
 * Гард - requireActiveUser(locale, { allowPaused: true }), тот же, что и на
 * /v2/settings: экран висит в настройках, и paused-пользователь должен видеть
 * свой код наравне с остальными пунктами меню, а не ловить редирект.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2InviteScreen } from "@/components/v2/InviteScreen";

export const dynamic = "force-dynamic";

export default async function V2InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invite");
  const user = await requireActiveUser(locale, { allowPaused: true });
  const unread = await getUnreadTotal(user.id);

  return (
    <>
      <MiniAppShell eyebrow={t("title")} align="top" footer={null}>
        <div className="v2-screen-in">
          <div style={{ marginBottom: "12px", marginLeft: "-4px" }}>
            <Link
              href="/v2/settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 4px",
                color: "var(--color-v2-ink-400)",
                textDecoration: "none",
                fontFamily: "var(--font-v2-body)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>
                ←
              </span>
              {t("back")}
            </Link>
          </div>

          <Headline size="lg" as="h1">
            {t("title")}
          </Headline>
          <Lead>{t("subtitle")}</Lead>

          <div style={{ marginTop: "28px" }}>
            <V2InviteScreen />
          </div>

          <div style={{ height: "80px" }} />
        </div>
      </MiniAppShell>
      <BottomNav active="profile" unread={unread} />
    </>
  );
}
