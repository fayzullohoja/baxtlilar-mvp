import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { PendingActions } from "@/components/onboarding/pending-actions";

export const dynamic = "force-dynamic";

export default async function PendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "moderation_pending");
  const t = await getTranslations("Onboarding");

  const steps = [t("pending_step_1"), t("pending_step_2"), t("pending_step_3")];

  return (
    <Screen title={t("pending_title")} subtitle={t("pending_subtitle")} step={6} totalSteps={6}>
      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-4 text-sm mb-4">{t("pending_info")}</div>
      <p className="text-sm font-medium text-baxt-coral mb-5">{t("pending_status")}</p>

      <div className="rounded-2xl border border-baxt-border bg-baxt-card p-4 mb-4">
        <div className="text-sm font-semibold text-baxt-navy mb-2">{t("pending_steps_title")}</div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-baxt-navy">
              <span className="mt-0.5 grid w-5 h-5 place-items-center rounded-full bg-baxt-coral text-white text-[11px] font-bold shrink-0">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-baxt-muted mb-2">{t("pending_delay_note")}</p>

      <PendingActions closeLabel={t("pending_cta_close")} homeLabel={t("pending_cta_home")} />
    </Screen>
  );
}
