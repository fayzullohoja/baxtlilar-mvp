import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserForVerificationRepair } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Screen } from "@/components/ui/screen";
import { NeedsChangesForm } from "@/components/onboarding/needs-changes-form";

export const dynamic = "force-dynamic";

export default async function NeedsChangesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Пускаем по состоянию верификации, а не по шагу: после shadow-active человек
  // в момент решения модератора стоит на шаге анкеты (или уже active), и гейт по
  // шагу увёл бы его отсюда обратно в анкету - то есть повторная подача
  // документов была бы недостижима навсегда.
  const user = await requireUserForVerificationRepair(locale, "needs_changes");
  const t = await getTranslations("Onboarding");

  const { data: doc } = await supabaseAdmin()
    .from("user_documents")
    .select("reject_reason, reject_target")
    .eq("user_id", user.id)
    .maybeSingle();
  const target = (doc?.reject_target as "passport" | "selfie" | "both" | null) ?? "both";

  return (
    <Screen title={t("nc_title")} subtitle={t("nc_subtitle")} step={5} totalSteps={7}>
      {doc?.reject_reason ? (
        <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
          <div className="font-medium text-amber-800 mb-1">{t("nc_reason_label")}</div>
          <div className="text-amber-900">{doc.reject_reason as string}</div>
        </div>
      ) : null}
      <NeedsChangesForm target={target} />
    </Screen>
  );
}
