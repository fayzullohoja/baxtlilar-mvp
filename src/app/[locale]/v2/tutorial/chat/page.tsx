/**
 * V2 Tutorial Step 3/4 — CHAT / MUTUAL модель.
 *
 * Цель: объяснить что чат не открывается просто потому что вы
 * "матчнулись". Чат = осознанное mutual: оба согласились продолжить.
 * После этого — обычный мессенджер, в котором можно обмениваться
 * фото/голосом, но безопасно.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { TutorialStep } from "@/components/v2/TutorialStep";
import { StepDots } from "@/components/v2/StepDots";

export const dynamic = "force-dynamic";

export default async function TutorialChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "tutorial_chat");

  return (
    <MiniAppShell
      eyebrow="Знакомство · 3 из 4"
      align="top"
      footer={<TutorialStep cta="Дальше" />}
    >
      <StepDots total={4} current={3} />
      <Headline size="lg" as="h1">
        Чат открывается обоюдно.
      </Headline>
      <Lead>
        Ты отправил интерес. Второй человек открыл твой профиль и&nbsp;ответил
        интересом в&nbsp;ответ. Только тогда появляется чат.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        До этого момента вы друг другу пишите не&nbsp;можете. Ни&nbsp;ты ему,
        ни&nbsp;он тебе. Это не&nbsp;баг — это и&nbsp;есть продукт.
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        Когда чат открыт — обычная переписка с&nbsp;текстом, голосовыми
        и&nbsp;фото. Без таймеров и&nbsp;игр в&nbsp;&laquo;кто первый&raquo;.
      </Lead>
    </MiniAppShell>
  );
}
