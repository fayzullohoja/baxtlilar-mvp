import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { QuizForm } from "@/components/onboarding/quiz-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "quiz");
  const t = await getTranslations("Quiz");
  return (
    <Screen title={t("intro_title")} subtitle={t("intro_text")} step={7} totalSteps={7}>
      <QuizForm />
    </Screen>
  );
}
