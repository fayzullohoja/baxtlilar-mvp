// Passport data validation для admin verification 3-step studio.
// Чистая функция — никаких IO, ничего серверного.
// UZ PINFL: 14 цифр; 1-я цифра — код века+пола (3 = М 1900-1999, 4 = Ж 1900-1999,
// 5 = М 2000-2099, 6 = Ж 2000-2099), 7-я цифра дублирует пол (нечёт = M, чёт = F),
// 14-я — контрольная.
//
// ⚠️ Контрольная цифра и правило «первая цифра 3–6» — ЭВРИСТИКИ: точный алгоритм
// не сверен с официальной узбекской спекой (веса 7-3-1 + mod11-mod10 совпадают с
// паттерном росс. ИНН — возможно, скопированы). Источник истины — паспорт в руках
// модератора. Поэтому эти две проверки = severity "warn", НЕ "block": подсвечиваем
// вероятную опечатку, но НЕ мешаем записать то, что реально в документе (иначе
// один неверный коэффициент навсегда блокирует верификацию валидного человека).

export type PassportPayload = {
  last_name: string;
  first_name: string;
  middle_name?: string;
  birth_date: string; // YYYY-MM-DD
  gender: "M" | "F";
  citizenship: string;
  birth_place: string;
  passport_series: string;
  passport_number: string;
  pinfl: string;
  issued_by: string;
  issued_at: string;
  expires_at: string;
  region_code: string;
  district_code: string;
  locality: string;
  street_address: string;
};

export type FieldError = {
  field: keyof PassportPayload | "_form";
  severity: "block" | "warn";
  message: string;
};

const MANDATORY_TEXT_FIELDS: (keyof PassportPayload)[] = [
  "last_name",
  "first_name",
  "birth_place",
  "issued_by",
  "region_code",
  "district_code",
  "locality",
  "street_address",
];

const PASSPORT_SERIES_RE = /^[A-Z]{2}$/;
const PASSPORT_NUMBER_RE = /^[0-9]{7}$/;
const PINFL_RE = /^[0-9]{14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePassportPayload(p: Partial<PassportPayload>): FieldError[] {
  const errors: FieldError[] = [];

  for (const f of MANDATORY_TEXT_FIELDS) {
    const v = p[f];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push({ field: f, severity: "block", message: "Обязательное поле" });
    }
  }

  if (!p.gender || (p.gender !== "M" && p.gender !== "F")) {
    errors.push({ field: "gender", severity: "block", message: "Укажите пол" });
  }

  if (!p.citizenship || p.citizenship.trim() === "") {
    errors.push({ field: "citizenship", severity: "block", message: "Укажите гражданство" });
  }

  if (!p.passport_series || !PASSPORT_SERIES_RE.test(p.passport_series)) {
    errors.push({ field: "passport_series", severity: "block", message: "Серия: 2 заглавные латинские буквы" });
  }

  if (!p.passport_number || !PASSPORT_NUMBER_RE.test(p.passport_number)) {
    errors.push({ field: "passport_number", severity: "block", message: "Номер: 7 цифр" });
  }

  if (!p.pinfl || !PINFL_RE.test(p.pinfl)) {
    // Формат (14 цифр) — объективный, алгоритм-независимый → остаётся BLOCK.
    errors.push({ field: "pinfl", severity: "block", message: "ПИНФЛ: 14 цифр" });
  } else {
    // Первая цифра и контрольная — эвристики (см. коммент к validatePinflChecksum)
    // → WARN, не BLOCK. else-if: не сыпать обе, когда первая цифра уже неверна.
    if (!"3456".includes(p.pinfl[0])) {
      errors.push({
        field: "pinfl",
        severity: "warn",
        message: "ПИНФЛ: первая цифра обычно 3–6 (код века/пола) — перепроверьте номер",
      });
    } else if (!validatePinflChecksum(p.pinfl)) {
      errors.push({
        field: "pinfl",
        severity: "warn",
        message: "ПИНФЛ: контрольная цифра не сходится — перепроверьте номер",
      });
    }
    // Сверка пола — независима от контрольной цифры, показываем всегда при 14 цифрах.
    if (p.gender) {
      const encoded = pinflGenderDigit(p.pinfl);
      if (encoded && encoded !== p.gender) {
        errors.push({
          field: "gender",
          severity: "warn",
          message: `ПИНФЛ кодирует ${encoded}, выбрано ${p.gender}`,
        });
      }
    }
  }

  if (!p.birth_date || !DATE_RE.test(p.birth_date)) {
    errors.push({ field: "birth_date", severity: "block", message: "Дата рождения: YYYY-MM-DD" });
  } else {
    const bd = new Date(p.birth_date + "T00:00:00Z");
    if (isFinite(bd.getTime())) {
      const now = new Date();
      let age = now.getUTCFullYear() - bd.getUTCFullYear();
      const mDiff = now.getUTCMonth() - bd.getUTCMonth();
      if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < bd.getUTCDate())) age--;
      if (age < 18) {
        errors.push({
          field: "birth_date",
          severity: "block",
          message: "Возраст < 18 — требуется blocking-reject (категория minor)",
        });
      }
    }
  }

  if (!p.issued_at || !DATE_RE.test(p.issued_at)) {
    errors.push({ field: "issued_at", severity: "block", message: "Дата выдачи: YYYY-MM-DD" });
  }
  if (!p.expires_at || !DATE_RE.test(p.expires_at)) {
    errors.push({ field: "expires_at", severity: "block", message: "Срок действия: YYYY-MM-DD" });
  } else {
    const ex = new Date(p.expires_at + "T00:00:00Z");
    if (isFinite(ex.getTime()) && ex.getTime() < Date.now()) {
      errors.push({ field: "expires_at", severity: "warn", message: "Паспорт просрочен" });
    }
  }

  return errors;
}

// UZ PINFL checksum:
// 1-я цифра должна быть 3-6 (век рождения).
// Контрольная (14-я) = (sum of digits[0..12] * weights[7-3-1 repeating]) mod 11,
// затем mod 10 если результат = 10 (т.к. контрольная — одна цифра).
export function validatePinflChecksum(pinfl: string): boolean {
  if (!PINFL_RE.test(pinfl)) return false;
  if (!"3456".includes(pinfl[0])) return false;
  const weights = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7];
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(pinfl[i]) * weights[i];
  }
  const expected = sum % 11 % 10;
  return expected === Number(pinfl[13]);
}

export function pinflGenderDigit(pinfl: string): "M" | "F" | null {
  if (!PINFL_RE.test(pinfl)) return null;
  const d = Number(pinfl[6]);
  return d % 2 === 1 ? "M" : "F";
}
