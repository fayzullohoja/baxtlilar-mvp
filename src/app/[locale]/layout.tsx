import type { Metadata } from "next";
import { Manrope, Piazzolla } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TelegramInit } from "@/components/telegram-init";
import "../globals.css";

// V3 Visual DNA (Baxtlilar.dc.html): Piazzolla — serif-заголовки, Manrope — UI.
// Оба поддерживают кириллицу. CSS-переменные подхватываются в globals.css
// (--font-v2-display / --font-v2-body).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});
const piazzolla = Piazzolla({
  variable: "--font-piazzolla",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Baxtlilar",
  description: "Платформа для серьёзных знакомств с целью создания семьи",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${manrope.variable} ${piazzolla.variable} h-full antialiased`}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      </head>
      <body data-v2="true" className="min-h-full bg-v2-paper text-v2-ink-100">
        <NextIntlClientProvider>
          <TelegramInit />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
