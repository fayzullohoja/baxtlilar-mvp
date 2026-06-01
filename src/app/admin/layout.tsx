import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Baxtlilar — Админ",
  robots: { index: false, follow: false },
};

/** Корневой layout админки (вне локали). Тёмно-нейтральный B2B-вид. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
