import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { OtpForm } from "@/components/onboarding/otp-form";

export const dynamic = "force-dynamic";

export default async function OtpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "otp_pending");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("otp_title")} subtitle={t("otp_subtitle")} step={3} totalSteps={6}>
      <OtpForm />
    </Screen>
  );
}
