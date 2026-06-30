/**
 * V2 Tutorial Step 1/4 — INTRO.
 *
 * Цель: переключить ментальную модель пользователя ДО того как он увидит
 * ленту. На предыдущих свайп-аппах он привык к pattern recognition.
 * Здесь — другая механика, и об этом надо предупредить заранее, иначе
 * первая сессия будет с ожиданием, которое мы не подтверждаем.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations('Tutorial');

  return (
    <MiniAppShell
      eyebrow={t('intro.title')}
      align="top"
      footer={<TutorialStep cta={t('next')} />}
    >
      <StepDots total={4} current={1} />
      <Headline size="lg" as="h1">
        {t('intro.heading')}
      </Headline>
      <Lead>
        {t('intro.body1')}
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        {t('intro.body2')}
      </Lead>
    </MiniAppShell>
  );
}
