import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AnketaValuesForm } from "@/components/onboarding/anketa-values-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_values");
  const t = await getTranslations("Anketa");
  return (
    <Screen title={t("values_title")} step={3} totalSteps={7}>
      <AnketaValuesForm />
    </Screen>
  );
}
