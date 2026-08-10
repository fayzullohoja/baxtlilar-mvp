/**
 * Коды-приглашения: алфавит, генерация, нормализация ввода.
 *
 * Алфавит без похожих символов: нет 0 и O, нет 1, I и L. 31^6 ~ 887 млн
 * комбинаций - перебрать нельзя, продиктовать по телефону легко.
 */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 6;

/**
 * Кириллические буквы, визуально НЕОТЛИЧИМЫЕ от латинских. В Узбекистане много
 * печатают на кириллице, и без этой карты человек вводит "правильный" код, а
 * бот отвечает "такого кода нет" - самая обидная из возможных ошибок.
 */
const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H",
  Р: "P", С: "C", Т: "T", У: "Y", Х: "X",
};

/** Привести пользовательский ввод к каноническому виду кода. */
export function normalizeInviteCode(raw: string): string {
  const upper = (raw ?? "").toUpperCase();
  let out = "";
  for (const ch of upper) {
    const mapped = CYRILLIC_LOOKALIKES[ch] ?? ch;
    if (INVITE_CODE_ALPHABET.includes(mapped)) out += mapped;
  }
  return out;
}

/**
 * Достать код из свободного текста. Люди пересылают приглашение целиком
 * ("Держи код: 7K2MQX, заходи"), а не только сам код, поэтому просто
 * нормализовать всю строку нельзя - буквы из соседних слов подмешаются
 * в результат и код не найдётся.
 *
 * Ищем среди слов то, что после нормализации даёт ровно длину кода.
 * Если подходящих слов несколько - берём первое: код в сообщении обычно один,
 * а угадывать между кандидатами хуже, чем честно не найти.
 */
export function extractInviteCode(text: string): string {
  for (const token of (text ?? "").split(/\s+/)) {
    const c = normalizeInviteCode(token);
    if (c.length === INVITE_CODE_LENGTH) return c;
  }
  // Слова не подошли - последняя попытка: вся строка целиком. Покрывает случай,
  // когда человек прислал код, разбитый пробелами: "7K2 MQX".
  const whole = normalizeInviteCode(text);
  return whole.length === INVITE_CODE_LENGTH ? whole : "";
}

/** Сгенерировать новый код. Уникальность гарантирует индекс в БД, не эта функция. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length];
  return out;
}
