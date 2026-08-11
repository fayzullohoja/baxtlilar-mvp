/**
 * V2 Invite (Task 9, план invite-codes).
 *
 * Экран «Пригласить» - код приглашения крупно, ссылка на бота, счётчик
 * приглашённых. Открывается из настроек (см. Settings.invite_title в
 * SettingsActions.tsx).
 *
 * Раунд исправлений 1: verification_status уже приходит из requireActiveUser
 * бесплатно, поэтому карточку "не верифицирован" рисуем сразу на сервере -
 * НЕ approved-юзер раньше видел лишний GET /api/invite и вспышку "Загружаем…"
 * ради ответа, который был известен ещё до рендера страницы. Клиентский
 * V2InviteScreen (реальный HTTP-консюмер GET /api/invite, Task 8) монтируется
 * только approved-юзерам, которым код и счётчик действительно нужны -
 * получение и выдача кода по-прежнему целиком в route.ts, страница их не
 * дублирует. В самом V2InviteScreen ветка not_verified оставлена как защита
 * от гонки (статус изменился между рендером страницы и fetch), а не как
 * основной путь.
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
import { InviteNotVerifiedCard } from "@/components/v2/InviteNotVerifiedCard";

export const dynamic = "force-dynamic";

export default async function V2InvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invite");
  const tSettings = await getTranslations("Settings");
  const user = await requireActiveUser(locale, { allowPaused: true });
  const unread = await getUnreadTotal(user.id);
  const isApproved = user.verification_status === "approved";

  return (
    <>
      {/* eyebrow = заголовок раздела настроек ("Профиль"), а не Invite.title -
          иначе прямо под ним Headline повторял бы то же слово («Пригласить» /
          «Пригласить»). Так eyebrow работает как хлебная крошка "откуда пришли". */}
      <MiniAppShell eyebrow={tSettings("title")} align="top" footer={null}>
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
            {isApproved ? (
              <V2InviteScreen />
            ) : (
              <InviteNotVerifiedCard title={t("not_verified_title")} body={t("not_verified")} />
            )}
          </div>

          <div style={{ height: "80px" }} />
        </div>
      </MiniAppShell>
      <BottomNav active="profile" unread={unread} />
    </>
  );
}
