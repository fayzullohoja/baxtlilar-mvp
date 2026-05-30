import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function WelcomePage() {
  const t = useTranslations();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-8 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm bg-baxt-card border border-baxt-border rounded-3xl shadow-sm p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-baxt-coral flex items-center justify-center text-white text-3xl font-bold shadow-[0_8px_24px_-8px_rgba(226,82,107,0.5)]">
          B
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">{t("Brand.name")}</h1>
        <p className="text-base mb-2">{t("Brand.subtitle")}</p>
        <p className="text-sm text-baxt-muted mb-7">{t("Welcome.tagline")}</p>

        <ul className="text-sm text-left space-y-2 mb-7">
          <li className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-baxt-coral inline-block" />
            {t("Welcome.feature_verified")}
          </li>
          <li className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-baxt-coral inline-block" />
            {t("Welcome.feature_privacy")}
          </li>
          <li className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-baxt-coral inline-block" />
            {t("Welcome.feature_respect")}
          </li>
        </ul>

        <button
          type="button"
          className="w-full bg-baxt-coral hover:bg-baxt-coral-dk text-white font-medium rounded-full py-3 transition-colors"
        >
          {t("Welcome.start")}
        </button>

        <p className="text-[11px] text-baxt-muted mt-4 leading-snug">{t("Welcome.legal")}</p>
      </div>
    </main>
  );
}
