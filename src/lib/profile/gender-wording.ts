/**
 * Gender-wording helper (2026-06-30).
 *
 * Zero-cost lookup: разные пользователи видят разные лейблы у одного и того же
 * enum-значения. Значение (`value`) стабильно и одинаково в БД — меняется только
 * визуальная подпись в UI.
 *
 * Пример:
 *   HOUSEHOLD_RESPONSIBILITY_MODEL.mostly_partner
 *     М-юзер + ru → «В основном жена»
 *     Ж-юзер + ru → «В основном муж»
 *     М-юзер + uz → «Asosan xotin»
 *     Ж-юзер + uz → «Asosan er»
 *   При отсутствии пола или отсутствии переопределения возвращаем нейтральный
 *   лейбл из options.ts (`labelOf`).
 */

import {
  HOUSEHOLD_RESPONSIBILITY_MODEL,
  MARITAL_STATUS,
  labelOf,
  type Opt,
} from "./options";

export type Gender = "m" | "f";

type Locale = "ru" | "uz";

type PerGenderLabel = { ru: string; uz: string };
type OverrideEntry = { m?: PerGenderLabel; f?: PerGenderLabel };

/**
 * Registry: constName → соответствующий Opt[]. Нужен для нейтрального fallback
 * через существующий labelOf. Регистрируем только те константы, для которых у
 * нас есть gender-переопределения — для всех остальных helper прозрачно вернёт
 * нейтральный лейбл (если константу заранее зарегистрируют) либо просто value.
 */
const CONST_REGISTRY: Record<string, Opt[]> = {
  HOUSEHOLD_RESPONSIBILITY_MODEL,
  MARITAL_STATUS,
};

/**
 * Gender-специфичные подписи. Ключ первого уровня — имя константы (совпадает с
 * export name из options.ts). Ключ второго уровня — enum `value`.
 *
 * Расширение (не в MVP): FAMILY_ROLE_MODEL и WIFE_WORK_VIEW потенциально требуют
 * своего гендерного варианта — например, «Работа мужа» vs «Работа жены».
 * Пока оставляем нейтральные лейблы из options.ts; если понадобится — добавляем
 * запись сюда, никаких изменений в вызывающем коде не требуется.
 */
const GENDERED_OVERRIDES: Record<string, Record<string, OverrideEntry>> = {
  HOUSEHOLD_RESPONSIBILITY_MODEL: {
    mostly_partner: {
      m: { ru: "В основном жена", uz: "Asosan xotin" },
      f: { ru: "В основном муж", uz: "Asosan er" },
    },
  },
  // Ревью оунера Экран 5: семейное положение звучит по-разному для М/Ж.
  MARITAL_STATUS: {
    never: {
      m: { ru: "Холост", uz: "Boʻydoq" },
      f: { ru: "Не была в браке", uz: "Turmush qurmagan" },
    },
    widowed: {
      m: { ru: "Вдовец", uz: "Beva" },
      f: { ru: "Вдова", uz: "Beva" },
    },
  },
  // Extension points (MVP: не заполнены — используются нейтральные лейблы):
  // FAMILY_ROLE_MODEL: { ... },
  // WIFE_WORK_VIEW: { ... },
};

/**
 * Возвращает лейбл опции с учётом пола пользователя.
 *
 * @param constName Имя константы из options.ts (например `"HOUSEHOLD_RESPONSIBILITY_MODEL"`).
 * @param value    Enum-значение опции.
 * @param gender   Пол пользователя или null/undefined (тогда — нейтральный лейбл).
 * @param locale   Локаль отображения.
 * @returns Локализованный лейбл (gender-specific при наличии, иначе нейтральный).
 */
export function getGenderedOptionLabel(
  constName: string,
  value: string,
  gender: Gender | null | undefined,
  locale: Locale,
): string {
  if (gender === "m" || gender === "f") {
    const override = GENDERED_OVERRIDES[constName]?.[value]?.[gender];
    if (override) return override[locale];
  }
  const opts = CONST_REGISTRY[constName];
  if (opts) return labelOf(opts, value, locale);
  // Незарегистрированная константа — не роняем UI, отдаём value как в labelOf.
  return value;
}

/**
 * Заготовка для будущих gender-conditional вопросов (например, стем «Работа мужа»
 * vs «Работа жены»). MVP возвращает пустую строку — вызывающий код должен
 * фолбэчить на next-intl. Ключи и переопределения будут добавлены сюда по мере
 * необходимости, без изменений в форме.
 */
const GENDERED_QUESTION_OVERRIDES: Record<string, Record<Gender, { ru: string; uz: string }>> = {
  // "partnerWorkLabel": {
  //   m: { ru: "Работа жены", uz: "Xotinning ishi" },
  //   f: { ru: "Работа мужа", uz: "Erning ishi" },
  // },
};

/**
 * Extension point: gender-conditional стемы вопросов.
 * MVP: если ключ не переопределён — возвращаем пустую строку, чтобы вызывающий
 * компонент фолбэчил на `t(key)` из next-intl. Пусть новые ключи добавляются
 * здесь по мере появления, а форма остаётся неизменной.
 */
export function getGenderedQuestion(
  key: string,
  gender: Gender | null | undefined,
  locale: Locale,
): string {
  if (gender === "m" || gender === "f") {
    const override = GENDERED_QUESTION_OVERRIDES[key]?.[gender];
    if (override) return override[locale];
  }
  return "";
}
