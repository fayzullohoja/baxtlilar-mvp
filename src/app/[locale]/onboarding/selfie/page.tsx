import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { UploadForm } from "@/components/onboarding/upload-form";

export const dynamic = "force-dynamic";

export default async function SelfiePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "selfie_upload");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("selfie_title")} subtitle={t("selfie_subtitle")} step={5} totalSteps={6}>
      <UploadForm endpoint="/api/onboarding/selfie" uploadLabel={t("selfie_upload")} capture="user" />
      <p className="text-xs text-baxt-muted mt-4">{t("selfie_hint")}</p>
    </Screen>
  );
}
