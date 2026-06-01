import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AnketaBasicForm } from "@/components/onboarding/anketa-basic-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_basic");
  const t = await getTranslations("Anketa");
  return (
    <Screen title={t("basic_title")} subtitle={t("basic_subtitle")} step={1} totalSteps={7}>
      <AnketaBasicForm defaultName={user.telegram_first_name ?? ""} />
    </Screen>
  );
}
