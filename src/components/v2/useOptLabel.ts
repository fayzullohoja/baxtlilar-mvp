import { useTranslations } from "next-intl";
import { optLabel, optLabelOf, type OptTranslator } from "@/lib/profile/option-label";
import type { Gender } from "@/lib/profile/gender-wording";
import type { Opt } from "@/lib/profile/options";

/**
 * Лейблы вариантов ответа (конструктор текстовок Tier 2). БЕЗ "use client":
 * next-intl'овский useTranslations работает и в Server Components, поэтому один
 * хелпер годится и для RSC, и для клиентских форм.
 *
 * `gender` (если известен) включает гендерный вариант лейбла — ключ
 * `Options.<GROUP>.<value>__<m|f>`; он тоже редактируется в админке.
 *
 * Каст: next-intl типизирует ключи по схеме сообщений, а группа/значение здесь
 * вычисляются в рантайме (Opt.group + Opt.value), поэтому ключ — обычная строка.
 */
export function useOptLabel(locale: string, gender?: Gender | null) {
  const t = useTranslations("Options") as unknown as OptTranslator;
  return {
    /** Лейбл конкретного варианта. */
    label: (opt: Opt) => optLabel(t, opt, locale, gender),
    /** Лейбл по значению внутри группы (замена labelOf там, где есть переводчик). */
    labelOf: (group: Opt[], value: string) => optLabelOf(t, group, value, locale, gender),
  };
}
