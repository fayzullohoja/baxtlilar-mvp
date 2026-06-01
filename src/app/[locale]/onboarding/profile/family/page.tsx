import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AnketaFamilyForm } from "@/components/onboarding/anketa-family-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_family");
  const t = await getTranslations("Anketa");
  return (
    <Screen title={t("family_title")} step={2} totalSteps={7}>
      <AnketaFamilyForm />
    </Screen>
  );
}
