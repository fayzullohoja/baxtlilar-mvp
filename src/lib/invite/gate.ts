import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/features/flags";
import { codeExistsButDisabled, findActiveCode } from "./store";

/**
 * Нужен ли человеку шаг ввода кода.
 *
 * Правило спеки: состояние определяется ДАННЫМИ (invite_redeemed_at/invite_exempt),
 * а не последовательностью событий. Поэтому перезапуск онбординга админом,
 * повторный вход и любое переключение рубильника ничего не ломают - ответ всегда
 * пересчитывается заново из текущей строки в базе, а не из истории переходов.
 */
export async function needsInviteStep(user: {
  invite_redeemed_at: string | null;
  invite_exempt: boolean;
}): Promise<boolean> {
  if (user.invite_exempt) return false;
  if (user.invite_redeemed_at) return false;
  return await isFeatureEnabled("invite_gate");
}

export type RedeemResult = { ok: true } | { ok: false; reason: "not_found" | "disabled" | "self" };

/**
 * Зачесть код пользователю.
 *
 * Перепроверяет код В МОМЕНТ ЗАЧЁТА (заново зовёт findActiveCode, а не полагается
 * на более раннюю проверку из роута/ссылки): между переходом по приглашению и
 * этим шагом код мог погаснуть - например владельца забанили (см. Task 5,
 * disableCodesOfUser).
 */
export async function redeemCode(userId: string, raw: string): Promise<RedeemResult> {
  const row = await findActiveCode(raw);
  if (!row) {
    // Различаем "кода нет" и "код погашен": иначе человеку с погашенным кодом
    // советуют проверить раскладку, и он проверяет её бесконечно вместо того,
    // чтобы попросить у пригласившего новый код.
    return { ok: false, reason: (await codeExistsButDisabled(raw)) ? "disabled" : "not_found" };
  }
  if (row.owner_id === userId) return { ok: false, reason: "self" };

  // invited_by пишется ОДИН РАЗ и навсегда - иначе переход по ЧУЖОЙ ссылке позже
  // переписал бы историю "кто кого привёл". Условие .is(..., null) в WHERE
  // защищает саму СТРОКУ атомарно: Postgres не даст UPDATE тронуть строку, где
  // invite_redeemed_at уже не null (это верно и под гонкой - вторая параллельная
  // команда физически не увидит освободившийся WHERE, пока первая не закоммитится).
  //
  // Но честный ОТВЕТ вызывающему коду - отдельный вопрос. Наш адаптер
  // (src/lib/db/query-builder.ts) на update БЕЗ .select() не пробрасывает
  // rowCount от Postgres: error всегда null, даже если WHERE не совпал ни с
  // одной строкой. Без .select() ниже повторный зачёт молча вернул бы
  // { ok: true }, ничего не записав, - данные были бы защищены, а вызывающий
  // код (и через него человек) получил бы ложный "успех". .select("id") +
  // проверка пустого результата делает исход наблюдаемым: пустой массив =
  // WHERE не совпал = зачитывать было нечего.
  const { data, error } = await supabaseAdmin()
    .from("users")
    .update({
      invited_by: row.owner_id,
      invite_code_id: row.id,
      invite_redeemed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("invite_redeemed_at", null)
    .select("id");
  if (error || !data?.length) {
    // Причина здесь - не буквально "кода нет" (код найден и валиден), но
    // отдельный 4-й reason ради этого случая не заводим: в спеке заявлены
    // ровно три причины, оба места вызова в Task 7 проверяют invite_redeemed_at
    // ДО вызова redeemCode (штатный поток сюда не попадает), и Task 7 уже
    // сводит любую НЕ "disabled" причину к одному и тому же тексту. Это
    // defensive-backstop на гонку/дубль вебхука, а не отдельный UX-путь.
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}
