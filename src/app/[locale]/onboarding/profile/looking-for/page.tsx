import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AnketaLookingForm } from "@/components/onboarding/anketa-looking-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_looking_for");
  const t = await getTranslations("Anketa");
  return (
    <Screen title={t("looking_title")} step={4} totalSteps={7}>
      <AnketaLookingForm />
    </Screen>
  );
}
