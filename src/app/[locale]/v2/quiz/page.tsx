/**
 * V2 Quiz (Blueprint §3.3 B7) — психо-портрет Big Five.
 * 10 вопросов в один скролл, editorial-стиль.
 * API: /api/onboarding/quiz/complete.
 */

import { setRequestLocale } from "next-intl/server";
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

  return (
    <MiniAppShell eyebrow="Психо-портрет" align="top">
      <Headline size="lg" as="h1">
        Десять вопросов про&nbsp;Вас.
      </Headline>
      <Lead>
        Big Five — простая модель личности. Не диагноз, не приговор. Просто
        точки, по которым алгоритм поймёт совпадение в характере, а не только
        в анкете.
      </Lead>
      <Lead style={{ marginTop: "16px", fontSize: "14px" }}>
        Шкала 1–5: насколько утверждение про Вас. Без правильных ответов.
      </Lead>

      <div
        style={{
          marginTop: "40px",
          paddingTop: "24px",
          borderTop: "1px solid var(--color-v2-ink-500)",
        }}
      >
        <V2QuizForm locale={locale} />
      </div>
    </MiniAppShell>
  );
}
