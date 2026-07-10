import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";

export type Mini = { id: string; name: string; age: number | null; city: string; photoUrl: string | null };

/** Краткие карточки пользователей по id (для списков запросов/чатов). Только approved-фото. */
export async function getMiniProfiles(ids: string[]): Promise<Record<string, Mini>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const sb = supabaseAdmin();

  const { data: profs } = await sb
    .from("user_profiles")
    .select("user_id, display_name, birth_date, city")
    .in("user_id", unique);
  // Исключаем family: мини-карточка (thumbnail) может показываться ДО взаимного
  // интереса (напр. входящий pending-запрос), а family-фото — только post-mutual.
  // Полная галерея с family раскрывается через RevealedProfile (profile/[id]).
  const { data: photos } = await sb
    .from("profile_photos")
    .select("user_id, path, is_main, ord")
    .eq("status", "approved")
    .neq("photo_type", "family")
    .in("user_id", unique)
    .order("is_main", { ascending: false })
    .order("ord", { ascending: true });

  const pathBy: Record<string, string> = {};
  for (const ph of photos ?? []) {
    const uid = ph.user_id as string;
    if (!pathBy[uid]) pathBy[uid] = ph.path as string;
  }
  const urls = await signedPhotoUrls(Object.values(pathBy));
  const photoBy: Record<string, string> = {};
  for (const [uid, path] of Object.entries(pathBy)) if (urls[path]) photoBy[uid] = urls[path];

  const out: Record<string, Mini> = {};
  for (const p of profs ?? []) {
    const uid = p.user_id as string;
    out[uid] = {
      id: uid,
      name: (p.display_name as string) ?? "",
      age: p.birth_date ? ageFromDate(p.birth_date as string) : null,
      city: (p.city as string) ?? "",
      photoUrl: photoBy[uid] ?? null,
    };
  }
  return out;
}
