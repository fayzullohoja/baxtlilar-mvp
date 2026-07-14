import type { Opt } from "./options";
import { GENDERED_OVERRIDES, type Gender } from "./gender-wording";

/**
 * Лейбл варианта ответа (конструктор текстовок Tier 2).
 *
 * Источник истины для ОТОБРАЖЕНИЯ — i18n-строка `Options.<GROUP>.<value>`, которую
 * оунер правит в /admin/content (обычный DB-оверрайд, вся машинерия Tier 1).
 * ru/uz в options.ts остаются БАЗОЙ и служат страховкой.
 *
 * Гендерные варианты. Часть лейблов звучит по-разному для М/Ж («Холост» /
 * «Не была в браке»). Раньше они жили ТОЛЬКО в коде (GENDERED_OVERRIDES) — если бы
 * мы оставили так, оунер правил бы «Холост» в админке и НИЧЕГО бы не менялось
 * (пол известен у всех верифицированных, т.е. код-вариант всегда побеждал). Поэтому
 * гендерные варианты тоже редактируемы — ключ `Options.<GROUP>.<value>__<m|f>`.
 *
 * Порядок разрешения:
 *   1) `<GROUP>.<value>__<gender>` — редактируемый гендерный вариант;
 *   2) `<GROUP>.<value>`           — редактируемый нейтральный;
 *   3) GENDERED_OVERRIDES из кода  — страховка, если ключ не сгенерирован;
 *   4) базовые ru/uz из options.ts — последняя страховка (не сырой ключ юзеру).
 *
 * Значения (`value`) — enum-ключи zod + DB CHECK, здесь НЕ участвуют.
 */

/** Переводчик next-intl, заскоупленный на namespace `Options`. */
export type OptTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

export function optLabel(
  t: OptTranslator,
  opt: Opt,
  locale: string,
  gender?: Gender | null,
): string {
  const uz = locale === "uz";
  if (opt.group) {
    if (gender === "m" || gender === "f") {
      const gk = `${opt.group}.${opt.value}__${gender}`;
      if (t.has(gk)) return t(gk);
    }
    const key = `${opt.group}.${opt.value}`;
    if (t.has(key)) return t(key);
    // ключа нет (новая опция) → код-оверрайд по полу, если он есть
    if (gender === "m" || gender === "f") {
      const code = GENDERED_OVERRIDES[opt.group]?.[opt.value]?.[gender];
      if (code) return uz ? code.uz : code.ru;
    }
  }
  return uz ? opt.uz : opt.ru;
}

/** Лейбл по значению внутри группы (замена labelOf там, где есть переводчик). */
export function optLabelOf(
  t: OptTranslator,
  group: Opt[],
  value: string,
  locale: string,
  gender?: Gender | null,
): string {
  const opt = group.find((o) => o.value === value);
  if (!opt) return value; // как в labelOf: неизвестное значение отдаём как есть
  return optLabel(t, opt, locale, gender);
}

/** Суффикс гендерного ключа — общий для рендера и генератора. */
export const genderedKey = (group: string, value: string, g: Gender): string =>
  `${group}.${value}__${g}`;
