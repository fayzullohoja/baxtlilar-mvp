/**
 * V2 Tutorial Step 4/4 — SAFETY.
 *
 * Цель: сказать прямо что мы делаем когда что-то идёт не так.
 * Не клишированный "report", а конкретный SLA и&nbsp;что произойдёт.
 *
 * Финальный экран тура — кнопка "Готово" ведёт в /v2/welcome или /main
 * (router определит по lifecycle/verification_status).
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { TutorialStep } from "@/components/v2/TutorialStep";
import { StepDots } from "@/components/v2/StepDots";

export const dynamic = "force-dynamic";

export default async function TutorialSafetyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Tutorial');
  await requireUserAtStep(locale, "tutorial_safety");

  return (
    <MiniAppShell
      eyebrow={t('safety.title')}
      align="top"
      footer={<TutorialStep cta={t('complete')} showSkip={false} />}
    >
      <div className="v2-screen-in">
        <StepDots total={4} current={4} />
        <Headline size="lg" as="h1">
          {t('safety.heading')}
        </Headline>
        <Lead>
          {t('safety.body1')}
        </Lead>
        <Lead style={{ marginTop: "20px" }}>
          {t('safety.body2')}
        </Lead>
        <Lead style={{ marginTop: "20px" }}>
          {t('safety.body3')}
        </Lead>
      </div>
    </MiniAppShell>
  );
}
