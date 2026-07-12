/**
 * V2 Quiz (Blueprint §3.3 B7) — психо-портрет Big Five.
 * 10 вопросов в один скролл. Стиль «Живой Baxtlilar»: тёмный экран
 * (--v2-grad-dark), янтарный eyebrow, белый serif-заголовок.
 * API: /api/onboarding/quiz/complete.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Headline, Lead } from "@/components/v2/Headline";
import { V2QuizForm } from "@/components/v2/QuizForm";
import { BackButton } from "@/components/v2/BackButton";

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
        <div style={{ marginBottom: "12px", marginLeft: "-4px" }}>
          <BackButton variant="dark" />
        </div>
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
          {t("intro_eyebrow")}
        </div>
        <Headline size="lg" as="h1" style={{ color: "#FFF7F0", fontWeight: 800 }}>
          {t("intro_title")}
        </Headline>
        <Lead style={{ color: "rgba(255, 247, 240, 0.78)" }}>
          {t("intro_text")}
        </Lead>
        <Lead
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "rgba(255, 247, 240, 0.62)",
          }}
        >
          {t("intro_scale_note")}
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
