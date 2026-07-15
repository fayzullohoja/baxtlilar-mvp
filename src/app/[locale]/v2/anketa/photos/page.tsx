/**
 * V2 Anketa · Photos (Blueprint §3.3 B5 · ревью оунера Экран 13).
 * Типизированные слоты: портрет (обязателен, главное) / в полный рост (опц.) /
 * семейное (опц., только post-mutual). Существующие фото гидрируются на сервере.
 * API: /api/onboarding/profile/photo + photos-done.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { MiniAppShell } from "@/components/v2/MiniAppShell";
import { anketaProgress } from "@/lib/onboarding/anketa-progress";
import { Headline, Lead } from "@/components/v2/Headline";
import {
  V2AnketaPhotosForm,
  type InitialPhoto,
} from "@/components/v2/AnketaPhotosForm";

export const dynamic = "force-dynamic";

export default async function V2AnketaPhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUserAtStep(locale, "profile_photos");
  const t = await getTranslations("Anketa");

  // Гидрация уже загруженных фото → слоты не «пустеют» при возврате на шаг.
  const sb = supabaseAdmin();
  const { data: rows } = await sb
    .from("profile_photos")
    .select("id, path, photo_type, is_main")
    .eq("user_id", user.id);
  const signed = await signedPhotoUrls((rows ?? []).map((r) => r.path as string));
  const initial: InitialPhoto[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    url: signed[r.path as string] ?? "",
    photo_type: (r.photo_type as string) ?? "portrait",
    is_main: (r.is_main as boolean) ?? false,
  }));

  return (
    <MiniAppShell progress={anketaProgress("profile_photos")} eyebrow={t("photos_eyebrow")} align="top" showBack>
      <Headline size="lg" as="h1">{t("photos_headline")}</Headline>
      <Lead>{t("photos_lead")}</Lead>

      <div style={{ marginTop: "32px" }}>
        <V2AnketaPhotosForm initial={initial} />
      </div>
    </MiniAppShell>
  );
}
