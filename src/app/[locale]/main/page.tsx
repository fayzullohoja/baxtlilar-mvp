import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { Screen } from "@/components/ui/screen";

export const dynamic = "force-dynamic";

export default async function MainPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  // На главную пускаем только активных; иначе — на актуальный шаг онбординга
  if (user!.lifecycle_state !== "active") redirect({ href: nextScreenFor(user!), locale });
  const t = await getTranslations("Main");

  return (
    <Screen title={t("title")} subtitle={t("subtitle")}>
      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-5 text-sm text-baxt-navy text-center">
        {t("feed_soon")}
      </div>
    </Screen>
  );
}
