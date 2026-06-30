/**
 * V2 Tutorial Step 3/4 — CHAT / MUTUAL модель.
 *
 * Цель: объяснить что чат не открывается просто потому что вы
 * "матчнулись". Чат = осознанное mutual: оба согласились продолжить.
 * После этого — обычный мессенджер, в котором можно обмениваться
 * фото/голосом, но безопасно.
 */

import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("Tutorial");

  return (
    <MiniAppShell
      eyebrow={t("chat.title")}
      align="top"
      footer={<TutorialStep cta={t("next")} />}
    >
      <StepDots total={4} current={3} />
      <Headline size="lg" as="h1">
        {t("chat.heading")}
      </Headline>
      <Lead>
        {t("chat.body1")}
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        {t("chat.body2")}
      </Lead>
      <Lead style={{ marginTop: "20px" }}>
        {t("chat.body3")}
      </Lead>
    </MiniAppShell>
  );
}
