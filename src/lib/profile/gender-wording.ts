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
  WIFE_WORK_VIEW,
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
  WIFE_WORK_VIEW,
};

/**
 * Gender-специфичные подписи. Ключ первого уровня — имя константы (совпадает с
 * export name из options.ts). Ключ второго уровня — enum `value`.
 *
 * WIFE_WORK_VIEW получил гендерные варианты 24.08.2026 по замечанию тестеров
 * family launch: женщине показывали мужские формулировки («моя жена») - вопрос
 * о работе супруга звучит зеркально, и нейтральные лейблы этого не покрывали.
 * Расширение оказалось ровно таким, как здесь и предполагалось: запись ниже,
 * в вызывающем коде ничего менять не пришлось.
 *
 * FAMILY_ROLE_MODEL пока оставлен нейтральным: «Семья с лидерством мужчины»
 * читается одинаково с обеих сторон, это описание уклада, а не роли говорящего.
 */
export const GENDERED_OVERRIDES: Record<string, Record<string, OverrideEntry>> = {
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
  // Замечание 7 family launch: вопрос о работе супруга зеркальный. Мужчина
  // отвечает про жену, женщина - про мужа. Раньше обе стороны видели один
  // нейтральный текст, а на проде поверх него стоял мужской оверрайд, и
  // женщинам показывали «моя жена».
  WIFE_WORK_VIEW: {
    welcome: {
      m: { ru: "Поддержу желание жены работать", uz: "Xotinimning ishlash istagini qoʻllab-quvvatlayman" },
      f: { ru: "Поддержу желание мужа работать", uz: "Erimning ishlash istagini qoʻllab-quvvatlayman" },
    },
    prefer_not: {
      m: { ru: "Предпочитаю, чтобы жена не работала", uz: "Xotinim ishlamasligini afzal koʻraman" },
      f: { ru: "Предпочитаю, чтобы муж не работал", uz: "Erim ishlamasligini afzal koʻraman" },
    },
    against: {
      m: { ru: "Не поддерживаю работу жены", uz: "Xotinimning ishlashini qoʻllab-quvvatlamayman" },
      f: { ru: "Не поддерживаю работу мужа", uz: "Erimning ishlashini qoʻllab-quvvatlamayman" },
    },
    // Эти два варианта не про супруга, а про самого отвечающего - но в русском
    // род всё равно слышен («согласен» / «согласна»), поэтому вариант нужен.
    ok_if_needed: {
      m: { ru: "Согласен, если вместе решим, что нужно", uz: "Birgalikda zarur deb qaror qilsak, roziman" },
      f: { ru: "Согласна, если вместе решим, что нужно", uz: "Birgalikda zarur deb qaror qilsak, roziman" },
    },
    discuss: {
      m: { ru: "Готов обсудить", uz: "Muhokama qilishga tayyorman" },
      f: { ru: "Готова обсудить", uz: "Muhokama qilishga tayyorman" },
    },
  },
  // Ревью оунера 1.11: план проживания после брака звучит по-разному для М/Ж.
  // «С семьёй мужа/жены» → «моя семья» vs «семья супруга/и» в зависимости от пола.
  POST_MARRIAGE_LIVING: {
    with_husband_family: {
      m: { ru: "Жить с моей семьёй", uz: "O‘z oilam bilan yashash" },
      f: { ru: "Жить с семьёй супруга", uz: "Turmush o‘rtog‘im oilasi bilan" },
    },
    with_wife_family: {
      m: { ru: "Жить с семьёй супруги", uz: "Turmush o‘rtog‘im oilasi bilan" },
      f: { ru: "Жить с моей семьёй", uz: "O‘z oilam bilan yashash" },
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
