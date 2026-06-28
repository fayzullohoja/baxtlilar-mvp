/**
 * V3 Sprint 1 ЗАГЛУШКА — Экран 3 «О себе» (bio + education + activity + employment).
 *
 * Sprint 1 деплоит её пустой чтобы flow basic → birth_place → self работал
 * без 404. Sprint 2 заменит реальной формой.
 *
 * Когда юзер сюда попал — он завершил birth-place. У нас пока нет реального
 * экрана, но transition уже произошёл. Кнопка ниже двигает в legacy
 * appearance (старый Sprint V2 ext поток), чтобы юзер не застрял.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { ContinueToAppearanceButton } from "@/components/v2/ContinueToAppearanceButton";

export const dynamic = "force-dynamic";

export default async function V2AnketaSelfStubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_self");

  return (
    <MiniAppShell eyebrow="Шаг 3 · Скоро" align="top">
      <Headline size="lg" as="h1">
        Этот экран скоро будет доступен.
      </Headline>
      <Lead>
        Мы&nbsp;готовим раздел «О&nbsp;себе»: образование, сфера деятельности
        и&nbsp;немного про&nbsp;характер. Пока продолжай с&nbsp;текущей анкетой —
        вернёмся к&nbsp;этому шагу позже.
      </Lead>

      <div style={{ marginTop: "32px" }}>
        <ContinueToAppearanceButton />
      </div>
    </MiniAppShell>
  );
}
