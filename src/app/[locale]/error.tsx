"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Граница ошибок пользовательской части (Mini App). Рендерится внутри
 * [locale]/layout → под NextIntlClientProvider, поэтому useTranslations доступен
 * и текст локализован (RU/UZ). Без неё throw в любой странице показывал бы сырую
 * страницу ошибки Next вместо аккуратного экрана с «Повторить».
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error("[app] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-baxt-pink-bg px-6 text-center">
      <h1 className="text-xl font-bold text-baxt-navy">{t("title")}</h1>
      <p className="mt-2 max-w-xs text-sm text-baxt-muted">{t("subtitle")}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-baxt-coral px-6 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        {t("retry")}
      </button>
    </div>
  );
}
