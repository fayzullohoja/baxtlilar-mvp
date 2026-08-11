/**
 * Экран «Оставить отзыв» - открывается из настроек рядом с «Пригласить»
 * (пункт меню на Feedback.entry_title, см. SettingsActions.tsx).
 *
 * Гард - requireActiveUser({ allowPaused: true }), как у /v2/invite и
 * /v2/settings: экран висит в настройках, и человек на паузе имеет право
 * сказать, почему он туда ушёл.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2FeedbackScreen } from "@/components/v2/FeedbackScreen";

export const dynamic = "force-dynamic";

export default async function V2FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Feedback");
  const tSettings = await getTranslations("Settings");
  const user = await requireActiveUser(locale, { allowPaused: true });
  const unread = await getUnreadTotal(user.id);

  return (
    <>
      {/* eyebrow = заголовок раздела настроек, а не Feedback.title - иначе
          прямо под ним Headline повторял бы то же слово. Так eyebrow работает
          как хлебная крошка «откуда пришли», ровно как на /v2/invite. */}
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
            <V2FeedbackScreen locale={locale} />
          </div>

          {/* Запас снизу под BottomNav: без него последняя карточка уезжает
              под панель навигации и кнопка «Отправить» частью скрыта. */}
          <div style={{ height: "80px" }} />
        </div>
      </MiniAppShell>
      <BottomNav active="profile" unread={unread} />
    </>
  );
}
