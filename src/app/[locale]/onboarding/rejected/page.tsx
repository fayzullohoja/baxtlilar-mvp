import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Screen } from "@/components/ui/screen";
import { RetryButton } from "@/components/onboarding/retry-button";
import { SupportLink } from "@/components/support-link";

export const dynamic = "force-dynamic";

export default async function RejectedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "verification_rejected");
  const t = await getTranslations("Onboarding");

  // MAJOR #2: branch на reject_category.
  // - 'blocking' → нет retry-кнопки в DOM, юзер видит "обратитесь в поддержку".
  //   Отсутствие узла, а не disabled/hidden, защищает от devtools-bypass.
  // - 'technical' / NULL (legacy) → стандартный flow с retry.
  const user = await getCurrentUser();
  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("reject_category")
    .eq("user_id", user!.id)
    .maybeSingle();
  const isBlocking = doc?.reject_category === "blocking";

  if (isBlocking) {
    return (
      <Screen title={t("rejected_blocking_title")} subtitle={t("rejected_blocking_subtitle")}>
        <div className="mb-5 rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm text-baxt-navy">
          {t("rejected_blocking_body")}
        </div>
        <SupportLink label={t("rejected_blocking_cta")} />
      </Screen>
    );
  }

  return (
    <Screen title={t("rejected_title")} subtitle={t("rejected_subtitle")}>
      <div className="mb-5 rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm text-baxt-navy">
        {t("rejected_support")}
      </div>
      <RetryButton />
    </Screen>
  );
}
