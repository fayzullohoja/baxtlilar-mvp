import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { signedPhotoUrls } from "@/lib/uploads/storage";
import { ageFromDate } from "@/lib/profile/schemas";
import { PHOTO_TYPES_PRE_MUTUAL } from "@/lib/profile/options";

export type Mini = { id: string; name: string; age: number | null; city: string; photoUrl: string | null };

/** Краткие карточки пользователей по id (для списков запросов/чатов). Только approved-фото. */
export async function getMiniProfiles(ids: string[]): Promise<Record<string, Mini>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const sb = supabaseAdmin();

  // Сбой БД здесь НЕ равен «нет профилей»: молча вернув пусто, список рисует
  // пустые карточки со ссылкой в никуда. unwrapRows делает отказ видимым.
  const profs = unwrapRows(
    await sb
      .from("user_profiles")
      .select("user_id, display_name, birth_date, city")
      .in("user_id", unique),
  ) as Array<Record<string, unknown>>;
  // Мини-карточка (thumbnail) может показываться ДО взаимного интереса (напр.
  // входящий pending-запрос), поэтому только PRE-MUTUAL типы (портрет). Полный
  // рост + family раскрываются post-mutual через RevealedProfile (ревью оунера 1.18).
  const photos = unwrapRows(
    await sb
    .from("profile_photos")
    .select("user_id, path, is_main, ord")
    .eq("status", "approved")
    .in("photo_type", [...PHOTO_TYPES_PRE_MUTUAL])
    .in("user_id", unique)
    .order("is_main", { ascending: false })
    .order("ord", { ascending: true }),
  ) as Array<Record<string, unknown>>;

  const pathBy: Record<string, string> = {};
  for (const ph of photos) {
    const uid = ph.user_id as string;
    if (!pathBy[uid]) pathBy[uid] = ph.path as string;
  }
  const urls = await signedPhotoUrls(Object.values(pathBy));
  const photoBy: Record<string, string> = {};
  for (const [uid, path] of Object.entries(pathBy)) if (urls[path]) photoBy[uid] = urls[path];

  const out: Record<string, Mini> = {};
  for (const p of profs) {
    const uid = p.user_id as string;
    // PRIVACY: только ПЕРВОЕ имя (фамилия скрыта). Мини-карточка показывается и
    // ДО взаимного интереса (входящие pending-запросы в /requests), где фамилия
    // не должна утекать — так же, как ProgressiveProfile берёт первое слово.
    // Полное имя раскрывается post-mutual через RevealedProfile.
    const fullName = (p.display_name as string) ?? "";
    out[uid] = {
      id: uid,
      name: fullName.trim().split(/\s+/)[0] ?? "",
      age: p.birth_date ? ageFromDate(p.birth_date as string) : null,
      city: (p.city as string) ?? "",
      photoUrl: photoBy[uid] ?? null,
    };
  }
  return out;
}
