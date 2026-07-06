import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "../globals.css";

// FIX: /open-in-telegram лежит вне [locale] и раньше НЕ имел собственного layout,
// поэтому globals.css сюда не подгружался → страница рендерилась без стилей
// (сырой текст). Даём сегменту root-layout с <html>/<body> + таблицей стилей +
// шрифтами (паттерн как в [locale]/layout.tsx и admin/layout.tsx).

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Baxtlilar — откройте в Telegram",
  robots: { index: false, follow: false },
};

export default function OpenInTelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      // TG WebApp SDK выставляет --tg-viewport-height на <html> после загрузки →
      // React видит рассинхрон атрибутов. Ожидаемо для внешнего скрипта, глушим.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body data-v2="true" className="min-h-full bg-v2-paper text-v2-ink-100">
        {/* TG Desktop не инжектит window.Telegram.WebApp надёжно — грузим SDK
            рано (beforeInteractive), чтобы AutoBootstrap успел его увидеть. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
