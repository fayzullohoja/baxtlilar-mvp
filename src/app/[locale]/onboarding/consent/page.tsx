import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { ConsentForm } from "@/components/onboarding/consent-form";

export const dynamic = "force-dynamic";

export default async function ConsentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "consent");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("consent_title")} subtitle={t("consent_subtitle")} step={1} totalSteps={6}>
      <p className="text-sm mb-5 rounded-2xl bg-baxt-coral-bg px-4 py-3">{t("consent_intentions")}</p>
      <ConsentForm />
    </Screen>
  );
}
