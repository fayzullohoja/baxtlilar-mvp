/**
 * V2 Quiz (Blueprint §3.3 B7) — психо-портрет Big Five, 10 вопросов в один скролл.
 * 2026-07-12: приведён к общему стилю анкеты (MiniAppShell — светлый кремовый фон,
 * гранатовый акцент), вместо off-brand тёмного экрана. API: /api/onboarding/quiz/complete.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2QuizForm } from "@/components/v2/QuizForm";

export const dynamic = "force-dynamic";

export default async function V2QuizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "quiz");
  const t = await getTranslations("Quiz");

  return (
    <MiniAppShell eyebrow={t("intro_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("intro_title")}</Headline>
      <Lead>{t("intro_text")}</Lead>
      <Lead style={{ marginTop: "14px", fontSize: "14px", color: "var(--color-v2-ink-400)" }}>
        {t("intro_scale_note")}
      </Lead>

      <div
        className="v2-rise"
        style={{
          marginTop: "36px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        <V2QuizForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
