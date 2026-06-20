import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { Screen } from "@/components/ui/screen";
import { AnketaBasicForm } from "@/components/onboarding/anketa-basic-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_basic");
  const t = await getTranslations("Anketa");

  // Экран 13 спеки: intro-блок над формой basic — что заполняем + privacy.
  // Показываем всегда (после approve пользователь первый раз тут).
  const bullets = [t("intro_bullet_1"), t("intro_bullet_2"), t("intro_bullet_3"), t("intro_bullet_4")];

  return (
    <Screen title={t("basic_title")} subtitle={t("basic_subtitle")} step={1} totalSteps={7}>
      <div className="rounded-2xl border border-baxt-border bg-baxt-card p-4 mb-5">
        <div className="text-sm font-semibold text-baxt-navy mb-1">{t("intro_title")}</div>
        <p className="text-xs text-baxt-muted leading-snug mb-3">{t("intro_subtitle")}</p>
        <ul className="space-y-1.5 mb-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-baxt-navy">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-baxt-coral shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-baxt-muted leading-snug">{t("intro_privacy")}</p>
      </div>

      <AnketaBasicForm defaultName={user.telegram_first_name ?? ""} />
    </Screen>
  );
}
