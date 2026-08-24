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
 * Признак кода: после нормализации должны быть ровно 6 символов И хотя бы одна
 * цифра. Цифра есть в кодах, но не в обычных словах ни на русском, ни на узбекском,
 * ни на английском - это работает одинаково для всех трёх.
 *
 * Алгоритм:
 * 1. Ищем среди слов то, что после нормализации даёт 6 символов с цифрой.
 * 2. Если не найдено - пробуем нормализовать всю строку целиком (для кода,
 *    разбитого пробелами: "7K2 MQX" или "ВХТ 7К2").
 */
export function extractInviteCode(text: string): string {
  const tokens = (text ?? "").split(/\s+/);

  // Проход 1: ищем слово с 6 символами и цифрой.
  for (const token of tokens) {
    const normalized = normalizeInviteCode(token);
    if (normalized.length === INVITE_CODE_LENGTH && /\d/.test(normalized)) {
      return normalized;
    }
  }

  // Проход 2: вся строка целиком (для кода, разбитого пробелами).
  const whole = normalizeInviteCode(text);
  if (whole.length === INVITE_CODE_LENGTH && /\d/.test(whole)) return whole;

  return "";
}

/**
 * Сгенерировать новый код. Уникальность гарантирует индекс в БД, не эта функция.
 * Код обязательно содержит минимум одну цифру и минимум одну букву, чтобы
 * отличиться от обычных слов при извлечении из текста.
 */
export function generateInviteCode(): string {
  const MAX_ATTEMPTS = 100;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const bytes = new Uint8Array(INVITE_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    let code = "";
    let hasDigit = false;
    let hasLetter = false;

    for (const b of bytes) {
      const ch = INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length];
      code += ch;
      if (/\d/.test(ch)) hasDigit = true;
      if (/[A-Z]/.test(ch)) hasLetter = true;
    }

    if (hasDigit && hasLetter) return code;
  }

  // Резервный путь: если не выпало за 100 попыток, сгенерируем детерминированно.
  // Вероятность так мала (~0.0001%), что это условие почти не вызывается.
  const code =
    "2A" +
    Array(4)
      .fill(0)
      .map(() => INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)])
      .join("");
  return code;
}
