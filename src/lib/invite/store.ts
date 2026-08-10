import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractInviteCode, generateInviteCode } from "./code";

export type InviteCodeRow = {
  id: string;
  code: string;
  owner_id: string | null;
  disabled_at: string | null;
};

/**
 * Найти ДЕЙСТВУЮЩИЙ код по пользовательскому вводу.
 *
 * Достаём код через extractInviteCode (не normalizeInviteCode): люди пересылают
 * приглашение целиком ("Держи код: 7K2MQX, заходи"), а не только сам код -
 * normalizeInviteCode склеил бы буквы соседних слов и код бы не нашёлся.
 */
export async function findActiveCode(raw: string): Promise<InviteCodeRow | null> {
  const code = extractInviteCode(raw);
  if (!code) return null; // мусор - в базу не ходим
  const { data, error } = await supabaseAdmin()
    .from("invite_codes")
    .select("id, code, owner_id, disabled_at")
    .eq("code", code)
    .is("disabled_at", null)
    .maybeSingle();
  if (error) return null; // сбой БД = кода нет; вход закрыт, а не открыт настежь
  return (data as InviteCodeRow) ?? null;
}

/**
 * Существует ли такой код, но погашен. Нужен, чтобы показать человеку правильный
 * текст: "попросите новый" вместо "проверьте раскладку".
 *
 * Фильтруем disabled_at IS NOT NULL явно (а не просто "есть строка с таким
 * кодом"): функция должна отвечать именно на вопрос из своего имени - существует
 * и ПОГАШЕН, - а не полагаться на то, что вызывающий код уже отсеял активные
 * коды через findActiveCode. Так поведение верно и в отрыве от вызывающего кода.
 */
export async function codeExistsButDisabled(raw: string): Promise<boolean> {
  const code = extractInviteCode(raw);
  if (!code) return false;
  const { data } = await supabaseAdmin()
    .from("invite_codes")
    .select("id")
    .eq("code", code)
    .not("disabled_at", "is", null)
    .maybeSingle();
  return !!data;
}

/** Код пользователя; создаёт при отсутствии. Подстраховка на случай, если при одобрении верификации код не создался. */
export async function ensureCodeForUser(userId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("invite_codes")
    .select("code")
    .eq("owner_id", userId)
    .is("disabled_at", null)
    .maybeSingle();
  if (data) return (data as { code: string }).code;

  // Коллизия кода почти невероятна (31^6), но индекс её поймает - пробуем трижды.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { error } = await sb.from("invite_codes").insert({ code, owner_id: userId });
    if (!error) return code;

    // Ошибка insert бывает по ДВУМ разным причинам, и лечатся они по-разному:
    // 1) коллизия самого кода (31^6, почти невероятна) - новый code на
    //    следующем витке цикла решает её;
    // 2) гонка между select выше и insert: параллельный вызов ensureCodeForUser
    //    для ТОГО ЖЕ userId уже успел создать код первым - тогда insert бьётся
    //    об invite_codes_one_active_per_owner, и новый code эту причину не
    //    лечит (упрётся в тот же constraint сколько ни пробуй). Перечитываем -
    //    если код уже есть, отдаём его вместо того, чтобы жечь оставшиеся попытки.
    const { data: existing } = await sb
      .from("invite_codes")
      .select("code")
      .eq("owner_id", userId)
      .is("disabled_at", null)
      .maybeSingle();
    if (existing) return (existing as { code: string }).code;
  }
  throw new Error("не удалось выпустить код приглашения");
}

/** Погасить все активные коды пользователя (бан, утечка, ручное действие). */
export async function disableCodesOfUser(userId: string, reason: string): Promise<void> {
  await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq("owner_id", userId)
    .is("disabled_at", null);
}

/** Оживить коды, погашенные ИМЕННО из-за бана (разбан). Погашенные за утечку не трогаем. */
export async function reviveBanDisabledCodes(userId: string): Promise<void> {
  await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: null, disabled_reason: null })
    .eq("owner_id", userId)
    .eq("disabled_reason", "ban");
}

/** Сколько человек пришло по кодам этого пользователя. Считаем на месте - денормализация разъезжается с правдой. */
export async function countInvitedBy(userId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", userId)
    .is("deleted_at", null);
  return count ?? 0;
}
