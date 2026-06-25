import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { getRecommendations } from "@/lib/matching/recommend";
import { cityLabel } from "@/lib/profile/cities";
import { getUnreadTotal } from "@/lib/chat/list";
import { BottomNav } from "@/components/bottom-nav";
import { deriveRole, hasPermission } from "@/lib/v2/permissions";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { VerificationPlashka } from "@/components/v2/VerificationPlashka";

export const dynamic = "force-dynamic";

export default async function FeedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale);
  const role = deriveRole(user.lifecycle_state, user.verification_status);

  // V2 Shadow Active: lifecycle=active НО verification!=approved → плашка вместо ленты.
  // Permission gate fail-closed: если роль не имеет view_feed, не зовём
  // getRecommendations (защита от утечки данных через permission bug).
  if (!hasPermission(role, "view_feed")) {
    return (
      <>
        <MiniAppShell
          eyebrow="Baxtlilar"
          align="top"
          footer={null}
        >
          <VerificationPlashka
            status={user.verification_status}
            submittedAt={user.verification_submitted_at}
          />
        </MiniAppShell>
        <BottomNav active="feed" unread={await getUnreadTotal(user.id)} />
      </>
    );
  }

  // Verified path (legacy V1 styling — будет переделано в Sprint 3).
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
                <div className="text-xs text-baxt-muted">{cityLabel(c.city, locale)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav active="feed" unread={await getUnreadTotal(user.id)} />
    </main>
  );
}
