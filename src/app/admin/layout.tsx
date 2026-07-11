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
      <body className="bx-admin min-h-full bg-slate-100 text-slate-800 antialiased">
        {/* UX-FOCUS: видимое кольцо фокуса ТОЛЬКО для клавиатуры (:focus-visible),
            scoped к .bx-admin, чтобы не влиять на mini-app. Раньше tab-фокус был
            невидим — оператор с клавиатуры не понимал, где находится. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
.bx-admin :focus-visible{outline:2px solid #2d4a5c;outline-offset:2px;border-radius:4px}
.bx-admin :focus:not(:focus-visible){outline:none}
`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
