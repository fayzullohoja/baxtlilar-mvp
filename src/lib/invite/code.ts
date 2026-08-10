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
 * Нормализовать с отслеживанием замен из карты кириллицы. Нужно для приоритизации
 * в extractInviteCode: слова, которые требуют замены, обычно это попытка ввода на
 * кириллице, а слова БЕЗ замен - это или чистая латиница (очень похоже на код),
 * или кириллица, которой вообще нет в карте.
 */
function normalizeWithTracking(raw: string): { normalized: string; hadReplacements: boolean } {
  const upper = (raw ?? "").toUpperCase();
  let out = "";
  let hadReplacements = false;
  for (const ch of upper) {
    const mapped = CYRILLIC_LOOKALIKES[ch];
    if (mapped) {
      hadReplacements = true;
      if (INVITE_CODE_ALPHABET.includes(mapped)) out += mapped;
    } else if (INVITE_CODE_ALPHABET.includes(ch)) {
      out += ch;
    }
  }
  return { normalized: out, hadReplacements };
}

/**
 * Достать код из свободного текста. Люди пересылают приглашение целиком
 * ("Держи код: 7K2MQX, заходи"), а не только сам код, поэтому просто
 * нормализовать всю строку нельзя - буквы из соседних слов подмешаются
 * в результат и код не найдётся.
 *
 * Ищем среди слов то, что после нормализации даёт ровно длину кода, с приоритетом:
 * 1. Слова БЕЗ замен из карты кириллицы (это очень похоже на человека, который
 *    вставил чистый латинский код);
 * 2. Слова С заменами (человек набрал код на кириллице);
 * 3. Вся строка целиком (для кода, разбитого пробелами: "7K2 MQX"), но ТОЛЬКО если
 *    нет замен - иначе подмешаем соседние слова вместо честного отказа.
 */
export function extractInviteCode(text: string): string {
  const tokens = (text ?? "").split(/\s+/);

  // Проход 1: слова БЕЗ замен - самые вероятные коды.
  for (const token of tokens) {
    const { normalized, hadReplacements } = normalizeWithTracking(token);
    if (!hadReplacements && normalized.length === INVITE_CODE_LENGTH) return normalized;
  }

  // Проход 2: слова С заменами - человек на кириллице.
  for (const token of tokens) {
    const { normalized, hadReplacements } = normalizeWithTracking(token);
    if (hadReplacements && normalized.length === INVITE_CODE_LENGTH) return normalized;
  }

  // Проход 3: вся строка целиком, но только если в ней нет замен. Это покрывает
  // "7K2 MQX", но не "А 7K2MQ" - честно вернёт пустую строку вместо подмешивания.
  const { normalized: whole, hadReplacements: wholeHadReplacements } = normalizeWithTracking(text);
  if (!wholeHadReplacements && whole.length === INVITE_CODE_LENGTH) return whole;

  return "";
}

/** Сгенерировать новый код. Уникальность гарантирует индекс в БД, не эта функция. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length];
  return out;
}
