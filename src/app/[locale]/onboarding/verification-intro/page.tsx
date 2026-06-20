import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { VerificationIntroCta } from "@/components/onboarding/verification-intro-cta";

export const dynamic = "force-dynamic";

// MAJOR #1 (spec Экран 5, без OneID): промежуточный intro-экран между ботом и
// загрузкой паспорта. Объясняет «зачем верификация», «что попросим», задаёт
// ожидания по времени и приватности. Снижает drop-off перед паспортом.
export default async function VerificationIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUserAtStep(locale, "verification_intro");
  const t = await getTranslations("Onboarding");

  const bullets = [t("vi_bullet_1"), t("vi_bullet_2"), t("vi_bullet_3")];

  return (
    <Screen title={t("vi_title")} subtitle={t("vi_subtitle")} step={4} totalSteps={7}>
      <div className="rounded-2xl border border-baxt-border bg-baxt-card p-4 mb-4">
        <div className="text-sm font-semibold text-baxt-navy mb-2">{t("vi_bullets_title")}</div>
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-baxt-navy">
              <span className="mt-0.5 grid w-5 h-5 place-items-center rounded-full bg-baxt-coral text-white text-[11px] font-bold shrink-0">
                {i + 1}
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-baxt-coral-bg px-4 py-3 mb-4">
        <p className="text-xs text-baxt-navy leading-snug">{t("vi_time_note")}</p>
      </div>

      <p className="text-xs text-baxt-muted leading-snug">{t("vi_privacy")}</p>

      <VerificationIntroCta
        label={t("vi_cta")}
        pendingLabel={t("vi_cta_pending")}
        errorLabel={t("vi_error_retry")}
      />
    </Screen>
  );
}
