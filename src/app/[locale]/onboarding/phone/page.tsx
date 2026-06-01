import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { PhoneForm } from "@/components/onboarding/phone-form";

export const dynamic = "force-dynamic";

export default async function PhonePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "phone_input");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("phone_title")} subtitle={t("phone_subtitle")} step={2} totalSteps={6}>
      <PhoneForm />
    </Screen>
  );
}
