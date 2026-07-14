import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { getMergedMessages, type Locale } from "@/lib/i18n/overrides";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // Статичная база messages/<locale>.json + DB-оверрайды (конструктор текстовок).
  // Fail-safe: любой сбой оверлея (БД недоступна и т.п.) → чистая база, экран не падает.
  let messages: Record<string, unknown>;
  try {
    messages = await getMergedMessages(locale as Locale);
  } catch (e) {
    console.error("[i18n] overrides overlay failed, falling back to base:", e);
    messages = (await import(`../../messages/${locale}.json`)).default;
  }

  return { locale, messages };
});
