import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";

export const dynamic = "force-dynamic";

export default async function RejectedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "verification_rejected");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("rejected_title")} subtitle={t("rejected_subtitle")}>
      <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-800">
        {t("rejected_support")}
      </div>
    </Screen>
  );
}
