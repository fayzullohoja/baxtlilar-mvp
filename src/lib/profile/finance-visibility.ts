import { INCOME_SOURCE_STABILITY } from "./options";

/**
 * Family launch 2026-08 (замечание 3): вопрос о размере дохода не должен
 * показываться тем, кто только что сказал «дохода сейчас нет» или «предпочитаю
 * не отвечать».
 *
 * Почему только размер дохода, а не весь остаток экрана: оставшиеся два вопроса
 * («насколько для вас важна финансовая стабильность», «как вести семейный
 * бюджет») спрашивают про ВЗГЛЯДЫ, а не про деньги человека - они осмысленны
 * при любом ответе. А вот спросить «сколько вы зарабатываете» сразу после
 * «дохода нет» - это противоречие, а после «не хочу отвечать» - ещё и
 * невежливо: человек уже отказался говорить о доходе.
 *
 * Жильё (housing_status) от дохода не зависит и остаётся.
 */
const INCOME_ANSWER_CLOSES_AMOUNT = ["none", "prefer_not"] as const;

export function shouldAskIncomeRange(incomeSource: string | null | undefined): boolean {
  if (!incomeSource) return true; // ещё не выбрал - прятать нечего
  return !(INCOME_ANSWER_CLOSES_AMOUNT as readonly string[]).includes(incomeSource);
}

/** Значения, при которых размер дохода скрывается. Экспорт для теста-стража:
 *  если вариант переименуют в options.ts, тест это заметит. */
export const INCOME_VALUES_HIDING_AMOUNT: readonly string[] = INCOME_ANSWER_CLOSES_AMOUNT;

/** Страховка: перечисленные значения обязаны существовать в INCOME_SOURCE_STABILITY. */
export function incomeHidingValuesAreKnown(): boolean {
  const known = new Set(INCOME_SOURCE_STABILITY.map((o) => o.value));
  return INCOME_ANSWER_CLOSES_AMOUNT.every((v) => known.has(v));
}
