import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AttributionForm } from "@/components/onboarding/attribution-form";

export const dynamic = "force-dynamic";

// MAJOR #3 (spec Экран 12): источник привлечения. После квиза, перед active.
// Аналитика каналов для PO. Skip разрешён — не блокируем прогресс.
export default async function AttributionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "attribution");
  const t = await getTranslations("Onboarding");

  return (
    <Screen title={t("attr_title")} subtitle={t("attr_subtitle")} step={7} totalSteps={7}>
      <AttributionForm
        options={{
          telegram: t("attr_telegram"),
          instagram: t("attr_instagram"),
          friends: t("attr_friends"),
          facebook: t("attr_facebook"),
          tiktok: t("attr_tiktok"),
          youtube: t("attr_youtube"),
          ads: t("attr_ads"),
          search: t("attr_search"),
          media: t("attr_media"),
          event: t("attr_event"),
          other: t("attr_other"),
        }}
        cta={t("attr_cta")}
        ctaPending={t("attr_cta_pending")}
        skip={t("attr_skip")}
        errorLabel={t("attr_error")}
      />
    </Screen>
  );
}
