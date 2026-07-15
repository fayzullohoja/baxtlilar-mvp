/**
 * V2 Profile Detail (Blueprint §3.4 C3) — прогрессивное раскрытие.
 *
 *   Pre-mutual (нет чата с этим юзером) → ProgressiveProfile
 *   Post-mutual (есть чат)              → RevealedProfile (фото, возраст, всё)
 *
 * Safety guards (V1 паритет):
 *   - blocked в любую сторону → /main
 *   - target lifecycle != active → /main
 *   - target.profile.status != published → /main
 *   - смотришь сам себя → /main
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { areBlocked } from "@/lib/safety/blocks";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { ProgressiveProfile } from "@/components/v2/ProgressiveProfile";
import { toProgressiveView } from "@/lib/v2/progressive-view";
import { RevealedProfile, type RevealedProfileData } from "@/components/v2/RevealedProfile";
import { ProfileSafetyActions } from "@/components/v2/ProfileSafetyActions";
import { BottomNav } from "@/components/bottom-nav";
import { getUnreadTotal } from "@/lib/chat/list";

export const dynamic = "force-dynamic";

async function hasMutualChat(userA: string, userB: string): Promise<boolean> {
  // chats имеет CHECK (user_a < user_b). Сортируем для запроса.
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
  const { data } = await supabaseAdmin()
    .from("chats")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  return Boolean(data);
}

export default async function V2ProfileDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Profile');
  const viewer = await requireActiveUser(locale);
  if (id === viewer.id) redirect({ href: "/main", locale });

  const sb = supabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("id, lifecycle_state, verification_status")
    .eq("id", id)
    .maybeSingle();
  const { data: p } = await sb
    .from("user_profiles")
    .select(
      "display_name, birth_date, city, bio, marital_status, has_children, " +
        "future_children_plan, religion, top_life_values, education, " +
        "partner_age_min, partner_age_max, geo_preference, status",
    )
    .eq("user_id", id)
    .maybeSingle();
  if (!u || u.lifecycle_state !== "active" || !p || p.status !== "published") {
    redirect({ href: "/main", locale });
  }
  if (await areBlocked(viewer.id, id)) {
    redirect({ href: "/main", locale });
  }

  const isMutual = await hasMutualChat(viewer.id, id);
  const firstName = (p!.display_name as string).trim().split(/\s+/)[0] ?? "";
  const unread = await getUnreadTotal(viewer.id);

  if (isMutual) {
    // Post-mutual: full reveal
    const { data: photos } = await sb
      .from("profile_photos")
      .select("path")
      .eq("user_id", id)
      .eq("status", "approved")
      .order("is_main", { ascending: false })
      .order("ord", { ascending: true });
    const paths = (photos ?? []).map((ph) => ph.path as string);
    const signed = await signedPhotoUrls(paths);
    const urls = paths.map((path) => signed[path]).filter(Boolean);

    const data: RevealedProfileData = {
      display_name: (p!.display_name as string) ?? "",
      birth_date: (p!.birth_date as string) ?? null,
      city: (p!.city as string) ?? null,
      bio: (p!.bio as string) ?? null,
      marital_status: (p!.marital_status as string) ?? null,
      has_children: (p!.has_children as string) ?? null,
      future_children_plan: (p!.future_children_plan as string) ?? null,
      religion: (p!.religion as string) ?? null,
      top_life_values: (p!.top_life_values as string[]) ?? [],
      education: (p!.education as string) ?? null,
      photo_urls: urls,
    };

    return (
      <>
        <MiniAppShell eyebrow={t('title')} align="top" footer={null}>
          <div className="v2-screen-in">
            <RevealedProfile profile={data} locale={locale} />
            <ProfileSafetyActions targetId={id} targetFirstName={firstName} />
            <div style={{ height: "80px" }} />
          </div>
        </MiniAppShell>
        <BottomNav active="feed" unread={unread} />
      </>
    );
  }

  // Pre-mutual: anonymized. APP-1 — в клиентский компонент уходит ТОЛЬКО узкая
  // проекция (имя без фамилии, город, образование, религия, ценности, bio,
  // Big Five). Точная дата рождения, семейный статус, дети, предпочтения по
  // партнёру НЕ передаются на клиент → не могут быть спарсены до взаимного
  // интереса. См. toProgressiveView.
  const { data: q } = await sb
    .from("quiz_results")
    .select("vector")
    .eq("user_id", id)
    .maybeSingle();

  // Спек 1.18/1.20: портрет + возраст видны pre-mutual (гейт вьюера — active+approved
  // — выше по коду сохранён). Только портрет; точную дату НЕ отдаём (age в toProgressiveView).
  const { data: portrait } = await sb
    .from("profile_photos")
    .select("path")
    .eq("user_id", id)
    .eq("photo_type", "portrait")
    .eq("status", "approved")
    .maybeSingle();
  const portraitPath = portrait?.path as string | undefined;
  // 10-мин подпись портрета (короткий TTL против хотлинка чужого фото).
  const photoUrl = portraitPath
    ? (await signedPhotoUrls([portraitPath], 600))[portraitPath] ?? null
    : null;

  const progressiveData = toProgressiveView({
    display_name: (p!.display_name as string) ?? "",
    city: (p!.city as string) ?? null,
    education: (p!.education as string) ?? null,
    // religion НЕ передаём: matching-only (ревью оунера 2026-07-10), pre-mutual скрыта.
    top_life_values: (p!.top_life_values as string[]) ?? [],
    bio: (p!.bio as string) ?? null,
    vector: (q?.vector as Record<string, number>) ?? {},
    verification_status: (u!.verification_status as string) ?? null,
    birth_date: (p!.birth_date as string) ?? null,
    photo_url: photoUrl,
  });

  return (
    <>
      <MiniAppShell eyebrow={t('titlePreMutual')} align="top" footer={null}>
        <div className="v2-screen-in">
          <ProgressiveProfile profile={progressiveData} locale={locale} />
          <ProfileSafetyActions targetId={id} targetFirstName={firstName} />
          <div style={{ height: "80px" }} />
        </div>
      </MiniAppShell>
      <BottomNav active="feed" unread={unread} />
    </>
  );
}
