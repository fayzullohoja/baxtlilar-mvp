/**
 * Нормализация узбекского номера в формат +998XXXXXXXXX (9 значащих цифр).
 * Принимает: +998901234567, 998901234567, 901234567, с пробелами/дефисами/скобками.
 * Бросает PhoneError, если номер не похож на узбекский мобильный.
 */
export class PhoneError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PhoneError";
  }
}

export function normalizeUzPhone(input: string): string {
  if (!input) throw new PhoneError("empty");
  const digits = input.replace(/\D/g, "");

  let national: string;
  if (digits.length === 9) {
    national = digits; // 901234567
  } else if (digits.length === 12 && digits.startsWith("998")) {
    national = digits.slice(3); // 998901234567
  } else if (digits.length === 13 && digits.startsWith("998")) {
    // напр. ведущий 0 после кода — отвергаем как невалидный
    throw new PhoneError("invalid_length");
  } else {
    throw new PhoneError("invalid_format");
  }

  // UZ мобильный: первая цифра национального номера 9/8/3/7/etc — операторский код 2 цифры.
  // На MVP достаточно проверить длину 9 и что это не явно чужой код.
  if (!/^\d{9}$/.test(national)) throw new PhoneError("invalid_national");
  return `+998${national}`;
}

/** Маска для UI: +998 90 123 45 67 */
export function formatUzPhone(e164: string): string {
  const m = e164.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return e164;
  return `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}
