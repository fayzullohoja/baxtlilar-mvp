import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getRecommendations } from "@/lib/matching/recommend";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function FeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale);
  const t = await getTranslations("Feed");
  const candidates = await getRecommendations(user.id, 20);

  return (
    <main className="min-h-screen pb-20 bg-baxt-pink-bg">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-baxt-navy">{t("title")}</h1>
        <p className="text-sm text-baxt-muted">{t("subtitle")}</p>
      </header>

      {candidates.length === 0 ? (
        <div className="px-5 py-16 text-center text-baxt-muted text-sm">{t("empty")}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {candidates.map((c) => (
            <Link
              key={c.user_id}
              href={`/profile/${c.user_id}`}
              className="rounded-2xl overflow-hidden bg-white border border-baxt-border"
            >
              <div className="aspect-[3/4] bg-baxt-coral-bg">
                {c.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="p-2.5">
                <div className="text-sm font-semibold text-baxt-navy">
                  {c.display_name}, {c.age}
                </div>
                <div className="text-xs text-baxt-muted">{c.city}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav active="feed" />
    </main>
  );
}
