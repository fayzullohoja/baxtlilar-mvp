/**
 * V2 Quiz (Blueprint §3.3 B7) — психо-портрет Big Five.
 * 10 вопросов в один скролл. Стиль «Живой Baxtlilar»: тёмный экран
 * (--v2-grad-dark), янтарный eyebrow, белый serif-заголовок.
 * API: /api/onboarding/quiz/complete.
 */

import { setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
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
    <div
      className="v2-screen-in"
      style={{
        minHeight: "100dvh",
        background: "var(--v2-grad-dark)",
        color: "#FFF7F0",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <main
        style={{
          maxWidth: "var(--v2-max-width)",
          width: "100%",
          margin: "0 auto",
          padding: "48px var(--v2-screen-padding) 40px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--color-v2-amber-2)",
            marginBottom: "24px",
          }}
        >
          Психо-портрет
        </div>
        <Headline size="lg" as="h1" style={{ color: "#FFF7F0", fontWeight: 800 }}>
          Десять вопросов про&nbsp;Вас.
        </Headline>
        <Lead style={{ color: "rgba(255, 247, 240, 0.78)" }}>
          Big Five — простая модель личности. Не диагноз, не приговор. Просто
          точки, по которым алгоритм поймёт совпадение в характере, а не только
          в анкете.
        </Lead>
        <Lead
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "rgba(255, 247, 240, 0.62)",
          }}
        >
          Шкала 1–5: насколько утверждение про Вас. Без правильных ответов.
        </Lead>

        <div
          className="v2-rise"
          style={{
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255, 247, 240, 0.18)",
          }}
        >
          <V2QuizForm locale={locale} />
        </div>
      </main>
    </div>
  );
}
