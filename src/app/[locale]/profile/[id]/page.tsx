import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_PHOTOS } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import {
  labelOf,
  RELIGION,
  EDUCATION,
  EMPLOYMENT,
  MARITAL_STATUS,
  HAS_CHILDREN,
  CHILDREN_PLAN,
  LIFE_VALUES,
} from "@/lib/profile/options";
import { cityLabel } from "@/lib/profile/cities";
import { ProfileActions } from "@/components/profile/profile-actions";

export const dynamic = "force-dynamic";

export default async function ProfileDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveUser(locale);
  if (id === viewer.id) redirect({ href: "/main", locale });
  const t = await getTranslations("ProfileView");
  const sb = supabaseAdmin();

  // только активный опубликованный профиль (контакты НЕ выбираем — приватность)
  const { data: u } = await sb
    .from("users")
    .select("id, lifecycle_state")
    .eq("id", id)
    .maybeSingle();
  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, birth_date, city, bio, marital_status, has_children, children_plan, religion, religion_importance, values, education, employment, status")
    .eq("user_id", id)
    .maybeSingle();
  if (!u || u.lifecycle_state !== "active" || !p || p.status !== "published")
    redirect({ href: "/main", locale });

  const { data: photos } = await sb
    .from("profile_photos")
    .select("path")
    .eq("user_id", id)
    .eq("status", "approved")
    .order("is_main", { ascending: false })
    .order("ord", { ascending: true });
  const urls = (photos ?? []).map((ph) => sb.storage.from(BUCKET_PHOTOS).getPublicUrl(ph.path as string).data.publicUrl);
  const age = p!.birth_date ? ageFromDate(p!.birth_date as string) : null;
  const L = (list: typeof RELIGION, v: unknown) => (v ? labelOf(list, v as string, locale) : null);

  const rows: [string, string | null][] = [
    [t("religion"), L(RELIGION, p!.religion)],
    [t("marital"), L(MARITAL_STATUS, p!.marital_status)],
    [t("children"), L(HAS_CHILDREN, p!.has_children)],
    [t("children_plan"), L(CHILDREN_PLAN, p!.children_plan)],
    [t("education"), L(EDUCATION, p!.education)],
    [t("employment"), L(EMPLOYMENT, p!.employment)],
  ];
  const values = ((p!.values as string[]) ?? []).map((v) => labelOf(LIFE_VALUES, v, locale));

  return (
    <main className="min-h-screen pb-28 bg-baxt-pink-bg">
      <div className="bg-baxt-coral-bg">
        {urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[0]} alt="" className="w-full aspect-[4/5] object-cover" />
        ) : null}
      </div>
      <div className="px-5 py-4">
        <h1 className="text-2xl font-bold text-baxt-navy">
          {(p!.display_name as string) ?? ""}
          {age ? `, ${age}` : ""}
        </h1>
        <p className="text-sm text-baxt-muted mb-1">{cityLabel(p!.city as string, locale)}</p>
        <span className="inline-block text-[11px] bg-baxt-coral text-white px-2 py-0.5 rounded-full mb-4">
          {t("verified")}
        </span>

        {p!.bio ? <p className="text-sm text-baxt-navy mb-4 whitespace-pre-line">{p!.bio as string}</p> : null}

        {values.length ? (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {values.map((v) => (
              <span key={v} className="text-xs bg-white border border-baxt-border rounded-full px-2.5 py-1">
                {v}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="space-y-1.5 mb-6">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-baxt-border/60 py-1.5">
                <dt className="text-baxt-muted">{k}</dt>
                <dd className="text-baxt-navy">{v}</dd>
              </div>
            ))}
        </dl>

        {urls.slice(1).map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="" className="w-full rounded-2xl mb-3" />
        ))}

        <ProfileActions targetId={id} />
      </div>
    </main>
  );
}
