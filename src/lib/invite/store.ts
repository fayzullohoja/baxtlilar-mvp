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
  const { data, error } = await supabaseAdmin()
    .from("invite_codes")
    .select("id")
    .eq("code", code)
    .not("disabled_at", "is", null)
    .maybeSingle();
  // Сбой БД -> false (как будто код не погашен). Это НЕ открывает вход: единственный
  // вызывающий (redeemCode, Task 6) добирается сюда, только когда findActiveCode уже
  // не нашла активный код, и в обоих случаях (false здесь -> "not_found"; правда
  // "не погашен, просто не нашли" -> тоже "not_found") итог один - ok:false. Функция
  // лишь выбирает ТЕКСТ причины отказа для человека, поэтому бросать смысла нет: это
  // превратило бы мягкое "код не найден" на шаге ввода в жёсткий 500 без выигрыша
  // в безопасности - в отличие от гашения/оживления/счётчика ниже, где сбой либо
  // реально открывает вход, либо вводит оператора в заблуждение.
  if (error) return false;
  return !!data;
}

/** Код пользователя; создаёт при отсутствии. Подстраховка на случай, если при одобрении верификации код не создался. */
export async function ensureCodeForUser(userId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error: lookupError } = await sb
    .from("invite_codes")
    .select("code")
    .eq("owner_id", userId)
    .is("disabled_at", null)
    .maybeSingle();
  // Не смогли проверить, есть ли уже код, - не идём вслепую создавать новый.
  // Если бы пошли: insert либо создаст ВТОРОЙ активный код (если lookup наврал
  // из-за транзиентного сбоя, а строки на самом деле нет - маловероятно, но
  // именно так и рождаются дыры), либо предсказуемо упрётся в
  // invite_codes_one_active_per_owner и мы потратим 3 попытки на фейл с
  // непонятной причиной. Падаем сразу, честно про то, что именно не удалось.
  if (lookupError) throw new Error(`не удалось проверить код приглашения: ${lookupError.message}`);
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
    const { data: existing, error: raceError } = await sb
      .from("invite_codes")
      .select("code")
      .eq("owner_id", userId)
      .is("disabled_at", null)
      .maybeSingle();
    // Сбой САМОЙ перечитки - не бросаем немедленно (в отличие от lookupError
    // выше): здесь мы уже внутри retry-цикла, следующая попытка либо пройдёт,
    // либо повторит ту же ошибку, и цикл всё равно честно упадёт после 3
    // попыток, если проблема системная. Считаем неудачную перечитку как
    // "код не нашли" и пробуем ещё раз, а не удваиваем throw-пути в одном цикле.
    if (!raceError && existing) return (existing as { code: string }).code;
  }
  throw new Error("не удалось выпустить код приглашения");
}

/** Погасить все активные коды пользователя (бан, утечка, ручное действие). */
export async function disableCodesOfUser(userId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq("owner_id", userId)
    .is("disabled_at", null);
  // Гашение - рычаг безопасности (бан, утечка кода). Тихий провал здесь значит:
  // код остаётся активным и продолжает пускать людей в закрытый запуск, а
  // оператор в это время видит "готово". Бросаем, чтобы вызывающий роут вернул
  // честную ошибку вместо ложного успеха.
  if (error) throw new Error(`не удалось погасить коды пользователя: ${error.message}`);
}

/** Оживить коды, погашенные ИМЕННО из-за бана (разбан). Погашенные за утечку не трогаем. */
export async function reviveBanDisabledCodes(userId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("invite_codes")
    .update({ disabled_at: null, disabled_reason: null })
    .eq("owner_id", userId)
    .eq("disabled_reason", "ban");
  // Направление сбоя здесь безопасное (код остаётся погашенным, вход не
  // открывается), но тихий провал всё равно вводит в заблуждение: админ
  // разбанил человека, интерфейс отчитался об успехе, а invite-право не
  // восстановилось - и до следующего разбора никто об этом не узнает. Бросаем
  // ради единообразной обработки ошибок в файле и честного сигнала оператору,
  // а не потому что это дыра в безопасности (в отличие от disableCodesOfUser).
  if (error) throw new Error(`не удалось оживить коды пользователя: ${error.message}`);
}

/** Сколько человек пришло по кодам этого пользователя. Считаем на месте - денормализация разъезжается с правдой. */
export async function countInvitedBy(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", userId)
    .is("deleted_at", null);
  // "Не смогли посчитать" и "посчитали - вышло 0" - разные факты. Молча
  // схлопнуть их в 0 подставляет того, кто по счётчику ищет признаки массовой
  // вербовки: сбой БД он прочитает как "у этого кода приглашённых нет".
  // Бросаем, чтобы вызывающая сторона показала явную ошибку, а не тихий ноль.
  if (error) throw new Error(`не удалось посчитать приглашённых: ${error.message}`);
  return count ?? 0;
}
