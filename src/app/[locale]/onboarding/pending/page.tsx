import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";

export const dynamic = "force-dynamic";

export default async function PendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "moderation_pending");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("pending_title")} subtitle={t("pending_subtitle")} step={6} totalSteps={6}>
      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm">{t("pending_info")}</div>
      <p className="mt-4 text-sm font-medium text-baxt-coral">{t("pending_status")}</p>
    </Screen>
  );
}
