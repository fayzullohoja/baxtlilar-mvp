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

  const reqs = [t("selfie_req_1"), t("selfie_req_2"), t("selfie_req_3"), t("selfie_req_4"), t("selfie_req_5")];

  return (
    <Screen title={t("selfie_title")} subtitle={t("selfie_subtitle")} step={6} totalSteps={7}>
      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-3 mb-4">
        <div className="text-sm font-semibold text-baxt-navy mb-0.5">{t("selfie_how_works")}</div>
        <p className="text-xs text-baxt-muted leading-snug">{t("selfie_how_works_body")}</p>
      </div>

      <div className="rounded-2xl border border-baxt-border bg-baxt-card p-4 mb-4">
        <div className="text-sm font-semibold text-baxt-navy mb-2">{t("selfie_req_title")}</div>
        <ul className="space-y-1.5">
          {reqs.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-baxt-navy">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-baxt-coral shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <UploadForm endpoint="/api/onboarding/selfie" uploadLabel={t("selfie_upload")} capture="user" />

      <p className="text-xs text-baxt-muted mt-4">{t("selfie_privacy_footer")}</p>
    </Screen>
  );
}
