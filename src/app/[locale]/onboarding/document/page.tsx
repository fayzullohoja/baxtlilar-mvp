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

  const reqs = [t("doc_req_1"), t("doc_req_2"), t("doc_req_3"), t("doc_req_4"), t("doc_req_5")];

  return (
    <Screen title={t("doc_title")} subtitle={t("doc_subtitle")} step={5} totalSteps={7}>
      <div className="rounded-2xl border border-baxt-border bg-baxt-card p-4 mb-4">
        <div className="text-sm font-semibold text-baxt-navy mb-2">{t("doc_req_title")}</div>
        <ul className="space-y-1.5">
          {reqs.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-baxt-navy">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-baxt-coral shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <UploadForm endpoint="/api/onboarding/document" uploadLabel={t("doc_upload")} capture="environment" />

      <div className="mt-4 rounded-2xl bg-baxt-coral-bg px-4 py-3">
        <div className="text-sm font-semibold text-baxt-navy mb-0.5">{t("doc_privacy_title")}</div>
        <p className="text-xs text-baxt-muted leading-snug">{t("doc_privacy_body")}</p>
      </div>
      <p className="text-xs text-baxt-muted mt-3">{t("doc_hint")}</p>
    </Screen>
  );
}
