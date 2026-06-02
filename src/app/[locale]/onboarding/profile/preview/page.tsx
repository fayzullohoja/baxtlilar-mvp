import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrl } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import { cityLabel } from "@/lib/profile/cities";
import { Screen } from "@/components/ui/screen";
import { PublishButton } from "@/components/onboarding/publish-button";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_preview");
  const t = await getTranslations("Anketa");
  const sb = supabaseAdmin();

  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, birth_date, city, bio")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: mainPhoto } = await sb
    .from("profile_photos")
    .select("path")
    .eq("user_id", user.id)
    .eq("is_main", true)
    .maybeSingle();
  const photoUrl = mainPhoto
    ? await signedPhotoUrl(mainPhoto.path as string)
    : null;
  const age = p?.birth_date ? ageFromDate(p.birth_date as string) : null;

  return (
    <Screen title={t("preview_title")} subtitle={t("preview_subtitle")} step={6} totalSteps={7}>
      <div className="rounded-2xl overflow-hidden border border-baxt-border bg-white mb-5">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-full aspect-[4/5] object-cover" />
        ) : null}
        <div className="p-4">
          <div className="text-lg font-bold text-baxt-navy">
            {(p?.display_name as string) ?? ""}
            {age ? `, ${age}` : ""}
          </div>
          <div className="text-sm text-baxt-muted">{cityLabel(p?.city as string, locale)}</div>
          <p className="text-sm text-baxt-navy mt-2 whitespace-pre-line">{(p?.bio as string) ?? ""}</p>
        </div>
      </div>
      <PublishButton />
    </Screen>
  );
}
