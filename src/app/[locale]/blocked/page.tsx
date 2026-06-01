import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { Screen } from "@/components/ui/screen";

export const dynamic = "force-dynamic";

export default async function BlockedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  if (user!.lifecycle_state !== "blocked") redirect({ href: nextScreenFor(user!), locale });
  const t = await getTranslations("Blocked");

  return (
    <Screen title={t("title")} subtitle={t("subtitle")}>
      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm text-baxt-navy">
        {user!.blocked_reason || t("default_reason")}
      </div>
      <p className="text-xs text-baxt-muted mt-4 text-center">{t("support")}</p>
    </Screen>
  );
}
