import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { RetryButton } from "@/components/onboarding/retry-button";

export const dynamic = "force-dynamic";

export default async function RejectedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "verification_rejected");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("rejected_title")} subtitle={t("rejected_subtitle")}>
      <div className="mb-5 rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm text-baxt-navy">
        {t("rejected_support")}
      </div>
      <RetryButton />
    </Screen>
  );
}
