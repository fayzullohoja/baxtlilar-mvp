/**
 * V2 Tutorial Step 1/4 — INTRO.
 *
 * Цель: переключить ментальную модель пользователя ДО того как он увидит
 * ленту. На предыдущих свайп-аппах он привык к pattern recognition.
 * Здесь — другая механика, и об этом надо предупредить заранее, иначе
 * первая сессия будет с ожиданием, которое мы не подтверждаем.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { TutorialStep } from "@/components/v2/TutorialStep";
import { StepDots } from "@/components/v2/StepDots";

export const dynamic = "force-dynamic";

export default async function TutorialIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "tutorial_intro");

  return (
    <MiniAppShell
      eyebrow="Знакомство · 1 из 4"
      align="top"
      footer={<TutorialStep cta="Дальше" />}
    >
      <StepDots total={4} current={1} />
      <Headline size="lg" as="h1">
        Здесь всё работает не&nbsp;как обычно.
      </Headline>
      <Lead>
        Ты не увидишь сотни анкет за&nbsp;вечер. Лента маленькая, тщательно
        отобранная, без бесконечной прокрутки.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        Мы не показываем тебя людям, пока модератор не&nbsp;подтвердит твою
        личность. Параллельно ты пройдёшь короткий тур — что значит каждый
        экран, и&nbsp;на&nbsp;что обращать внимание.
      </Lead>
    </MiniAppShell>
  );
}
