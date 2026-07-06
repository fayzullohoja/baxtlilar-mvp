/**
 * V2 Tutorial Step 2/4 — SWIPE / INTEREST модель.
 *
 * Цель: объяснить что в Baxtlilar нет свайпа. Есть осознанный "интерес"
 * к конкретному человеку — с возможностью добавить личное сообщение.
 *
 * Anti-pattern назван прямо ("не свайп") — пользователь должен понять
 * почему это сделано иначе.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { TutorialStep } from "@/components/v2/TutorialStep";
import { StepDots } from "@/components/v2/StepDots";

export const dynamic = "force-dynamic";

export default async function TutorialSwipePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "tutorial_swipe");
  const t = await getTranslations("Tutorial");

  return (
    <MiniAppShell
      eyebrow={t("swipe.title")}
      align="top"
      footer={<TutorialStep cta={t("next")} />}
    >
      <div className="v2-screen-in">
        <StepDots total={4} current={2} />
        <Headline size="lg" as="h1">
          {t("swipe.heading")}
        </Headline>
        <Lead>
          {t("swipe.body1")}
        </Lead>
        <Lead style={{ marginTop: "20px" }}>
          {t("swipe.body2")}
        </Lead>
        <Lead style={{ marginTop: "20px" }}>
          {t("swipe.body3")}
        </Lead>
      </div>
    </MiniAppShell>
  );
}
