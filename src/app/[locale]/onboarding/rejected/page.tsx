import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserForVerificationRepair } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Screen } from "@/components/ui/screen";
import { RetryButton } from "@/components/onboarding/retry-button";
import { NeedsChangesForm } from "@/components/onboarding/needs-changes-form";
import { SupportLink } from "@/components/support-link";

export const dynamic = "force-dynamic";

export default async function RejectedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Пускаем по состоянию верификации, а не по шагу - см. needs-changes/page.tsx:
  // после shadow-active отказ застаёт человека на шаге анкеты или уже в active,
  // и гейт по шагу сделал бы этот экран недостижимым навсегда.
  const user = await requireUserForVerificationRepair(locale, "rejected");
  const t = await getTranslations("Onboarding");

  // MAJOR #2: branch на reject_category.
  // - 'blocking' → нет retry-кнопки в DOM, юзер видит "обратитесь в поддержку".
  //   Отсутствие узла, а не disabled/hidden, защищает от devtools-bypass.
  // - 'technical' / NULL (legacy) → стандартный flow с retry.
  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("reject_category")
    .eq("user_id", user.id)
    .maybeSingle();
  const isBlocking = doc?.reject_category === "blocking";

  // Кто ещё стоит ровно на верификационном шаге - идёт прежним путём: /retry
  // сбрасывает документы и возвращает его в мастер загрузки (doc_upload →
  // selfie_upload). Кто ушёл дальше - вернуть его на doc_upload нельзя (такого
  // ребра в графе шагов нет), поэтому он перезаливает оба файла прямо здесь,
  // тем же роутом /api/onboarding/fix, что и needs_changes.
  const canUseRetryWizard =
    user.lifecycle_state === "onboarding" && user.onboarding_step === "verification_rejected";

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
      {canUseRetryWizard ? <RetryButton /> : <NeedsChangesForm target="both" />}
    </Screen>
  );
}
