import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS, type LegalDoc } from "@/content/legal";

export const dynamic = "force-dynamic";

type Lang = "ru" | "uz";

const UI = {
  draftBanner: {
    ru: "Черновик — требует юридической проверки",
    uz: "Qoralama — yuridik tekshiruvdan oʻtkazilishi kerak",
  },
  back: {
    ru: "← На главную",
    uz: "← Bosh sahifaga",
  },
  versionLabel: {
    ru: "Версия документа",
    uz: "Hujjat versiyasi",
  },
} as const;

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const doc: LegalDoc | undefined =
    slug === "terms" || slug === "privacy" || slug === "offer"
      ? LEGAL_DOCS[slug]
      : undefined;

  if (!doc) notFound();

  const lang: Lang = locale === "uz" ? "uz" : "ru";

  return (
    <main className="min-h-screen bg-baxt-pink-bg px-4 py-6 text-baxt-navy">
      <div className="mx-auto max-w-screen-sm">
        <div className="mb-4 rounded-2xl border border-baxt-border bg-baxt-coral-bg px-4 py-3 text-sm font-medium text-baxt-coral-dk">
          {UI.draftBanner[lang]}
        </div>

        <Link
          href="/"
          className="mb-4 inline-block text-sm font-medium text-baxt-coral hover:text-baxt-coral-dk"
        >
          {UI.back[lang]}
        </Link>

        <article className="rounded-2xl bg-baxt-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <h1 className="mb-6 text-xl font-bold leading-snug sm:text-2xl">
            {doc.title[lang]}
          </h1>

          <div className="space-y-6">
            {doc.sections.map((section, i) => (
              <section key={i}>
                <h2 className="mb-2 text-base font-semibold leading-snug sm:text-lg">
                  {section.heading[lang]}
                </h2>
                <p className="text-sm leading-relaxed text-baxt-navy/90 sm:text-[15px]">
                  {section.body[lang]}
                </p>
              </section>
            ))}
          </div>

          <hr className="my-6 border-baxt-border" />

          <p className="text-xs text-baxt-muted">
            {UI.versionLabel[lang]}: {doc.version}
          </p>
        </article>
      </div>
    </main>
  );
}
