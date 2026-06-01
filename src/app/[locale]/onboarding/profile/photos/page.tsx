import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { PhotosForm } from "@/components/onboarding/photos-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "profile_photos");
  const t = await getTranslations("Anketa");
  return (
    <Screen title={t("photos_title")} subtitle={t("photos_subtitle")} step={5} totalSteps={7}>
      <PhotosForm />
    </Screen>
  );
}
