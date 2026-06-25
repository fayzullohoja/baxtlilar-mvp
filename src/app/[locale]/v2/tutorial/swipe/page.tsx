/**
 * V2 Tutorial Step 2/4 — SWIPE / INTEREST модель.
 *
 * Цель: объяснить что в Baxtlilar нет свайпа. Есть осознанный "интерес"
 * к конкретному человеку — с возможностью добавить личное сообщение.
 *
 * Anti-pattern назван прямо ("не свайп") — пользователь должен понять
 * почему это сделано иначе.
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell
      eyebrow="Знакомство · 2 из 4"
      align="top"
      footer={<TutorialStep cta="Дальше" />}
    >
      <StepDots total={4} current={2} />
      <Headline size="lg" as="h1">
        Не&nbsp;свайпы. Интересы.
      </Headline>
      <Lead>
        Чтобы сказать &laquo;ты мне интересен/интересна&raquo;, нужно открыть
        анкету целиком — фото, текст, ценности — и&nbsp;нажать&nbsp;
        <em>Отправить интерес</em>.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        К интересу можно (и&nbsp;стоит) добавить короткое сообщение про то,
        что зацепило. Не&nbsp;&laquo;привет&raquo;, не&nbsp;&laquo;как
        дела&raquo;.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        Поэтому никто никого не&nbsp;спамит. И&nbsp;поэтому ответ — это уже
        результат.
      </Lead>
    </MiniAppShell>
  );
}
