import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { UploadForm } from "@/components/onboarding/upload-form";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "doc_upload");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("doc_title")} subtitle={t("doc_subtitle")} step={4} totalSteps={6}>
      <UploadForm endpoint="/api/onboarding/document" uploadLabel={t("doc_upload")} capture="environment" />
      <p className="text-xs text-baxt-muted mt-4">{t("doc_hint")}</p>
    </Screen>
  );
}
