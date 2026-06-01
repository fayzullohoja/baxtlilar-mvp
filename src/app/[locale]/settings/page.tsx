import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireActiveUser } from "@/lib/auth/active-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKET_PHOTOS } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import { cityLabel } from "@/lib/profile/cities";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsActions } from "@/components/settings/settings-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireActiveUser(locale, { allowPaused: true });
  const t = await getTranslations("Settings");
  const sb = supabaseAdmin();

  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, birth_date, city")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: photo } = await sb
    .from("profile_photos")
    .select("path")
    .eq("user_id", user.id)
    .eq("is_main", true)
    .maybeSingle();
  const photoUrl = photo ? sb.storage.from(BUCKET_PHOTOS).getPublicUrl(photo.path as string).data.publicUrl : null;
  const age = p?.birth_date ? ageFromDate(p.birth_date as string) : null;

  return (
    <main className="min-h-screen pb-20 bg-baxt-pink-bg">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-baxt-navy">{t("title")}</h1>
      </header>
      <div className="px-5">
        <div className="flex items-center gap-3 bg-white border border-baxt-border rounded-2xl p-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-baxt-coral-bg overflow-hidden shrink-0">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div>
            <div className="font-semibold text-baxt-navy">
              {(p?.display_name as string) ?? ""}
              {age ? `, ${age}` : ""}
            </div>
            <div className="text-sm text-baxt-muted">{cityLabel(p?.city as string, locale)}</div>
            {user.lifecycle_state === "paused" ? (
              <span className="text-xs text-baxt-coral-dk">{t("status_paused")}</span>
            ) : null}
          </div>
        </div>
        <SettingsActions paused={user.lifecycle_state === "paused"} />
      </div>
      <BottomNav active="profile" />
    </main>
  );
}
