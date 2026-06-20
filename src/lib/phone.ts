export class PhoneError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PhoneError";
  }
}

/**
 * Нормализация международного номера в E.164 (`+<8-15 digits>`).
 *
 * Используется при contact-share в боте: Telegram уже верифицировал номер
 * на этапе регистрации TG-аккаунта, а наш чек `contact.user_id === sender.id`
 * гарантирует, что это именно его номер. Поэтому страновой код тут не имеет
 * отношения к безопасности — мы лишь приводим к каноническому формату.
 *
 * Резиденты/граждане УЗ с иностранными SIM-картами (диаспора, рабочие за
 * границей) должны проходить регистрацию без отказа. UZ-only валидация
 * вынесена в `normalizeUzPhone` (используется для админ-фильтров/аналитики).
 */
export function normalizeInternationalPhone(input: string): string {
  if (!input) throw new PhoneError("empty");
  const digits = input.replace(/\D/g, "");
  // E.164: минимум 7 (короткий гос/спец), на практике мобильные ≥8.
  // Максимум 15 — жёсткий предел E.164.
  if (digits.length < 8 || digits.length > 15) throw new PhoneError("invalid_length");
  return `+${digits}`;
}

/**
 * Нормализация узбекского номера в формат +998XXXXXXXXX (9 значащих цифр).
 * Принимает: +998901234567, 998901234567, 901234567, с пробелами/дефисами/скобками.
 * Бросает PhoneError, если номер не похож на узбекский мобильный.
 *
 * NB: в бот-flow с 2026-06-20 НЕ используется (см. normalizeInternationalPhone).
 * Оставлено для админ-аналитики и UI-форм где явно нужен только УЗ номер.
 */
export function normalizeUzPhone(input: string): string {
  if (!input) throw new PhoneError("empty");
  const digits = input.replace(/\D/g, "");

  let national: string;
  if (digits.length === 9) {
    national = digits; // 901234567
  } else if (digits.length === 12 && digits.startsWith("998")) {
    national = digits.slice(3); // 998901234567
  } else if (digits.length === 13 && digits.startsWith("998")) {
    throw new PhoneError("invalid_length");
  } else {
    throw new PhoneError("invalid_format");
  }

  if (!/^\d{9}$/.test(national)) throw new PhoneError("invalid_national");
  return `+998${national}`;
}

/** true если номер в E.164 узбекский (+998 + 9 цифр) — для админ-фильтров. */
export function isUzMobile(e164: string): boolean {
  return /^\+998\d{9}$/.test(e164);
}

/** Маска для UI: +998 90 123 45 67 (только для УЗ-номеров). */
export function formatUzPhone(e164: string): string {
  const m = e164.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return e164;
  return `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}
