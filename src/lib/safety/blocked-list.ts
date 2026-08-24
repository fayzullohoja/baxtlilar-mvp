import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMiniProfiles } from "@/lib/profile/mini";

/**
 * Кого этот человек заблокировал.
 *
 * Замечание 11 тестеров family launch: заблокированный исчезал полностью, и
 * список блокировок нигде не показывался. Человек не мог ни проверить, кого он
 * заблокировал, ни снять блокировку - хотя серверная ручка разблокировки в
 * /api/block была с самого начала. Получалось необратимое на вид действие,
 * которое на самом деле обратимо: люди блокировали по ошибке и жили с этим.
 *
 * Отдаём только СВОИ блокировки (кого заблокировал я). Обратное направление -
 * кто заблокировал меня - не показываем никогда: это раскрыло бы человеку, что
 * его заблокировали, а блокировка по замыслу тихая.
 */
export type BlockedPerson = {
  userId: string;
  name: string;
  age: number | null;
  city: string | null;
  photoUrl: string | null;
  blockedAt: string;
};

export async function loadBlockedByMe(viewerId: string): Promise<BlockedPerson[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) return [];

  const ids = data.map((r) => r.blocked_id as string);
  const minis = await getMiniProfiles(ids);

  return data.map((r) => {
    const id = r.blocked_id as string;
    const m = minis[id];
    return {
      userId: id,
      // Имя может отсутствовать (профиль удалён или ещё не заполнен) - в этом
      // случае показываем нейтральную подпись, а не пустоту: человеку важно
      // видеть, что блокировка есть, даже если карточка недоступна.
      name: m?.name ?? "",
      age: m?.age ?? null,
      city: m?.city ?? null,
      photoUrl: m?.photoUrl ?? null,
      blockedAt: r.created_at as string,
    };
  });
}
