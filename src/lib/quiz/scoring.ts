import { QUESTIONS, type Factor } from "./questions";

export type Answer = { question_id: string; value: number };
export type Vector = { O: number; C: number; E: number; A: number; ES: number; answered: number };

const FACTOR_OF: Record<string, Factor> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.factor]));
const REVERSE_OF: Record<string, boolean> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.reverse]));

/**
 * Вектор совместимости из ответов (1–5). По каждому фактору — среднее,
 * нормализованное в 0–100: (avg-1)/4*100. Факторы без ответов = 50 (нейтрально).
 *
 * reverse-вопросы (ревью оунера 2026-07-10) инвертируются перед усреднением:
 * 1↔5, 2↔4, 3=3 (значение = 6 - value). «Высокий фактор» = согласие с прямым и
 * несогласие с обратным утверждением — семантика вектора остаётся консистентной.
 */
export function computeVector(answers: Answer[]): Vector {
  const buckets: Record<Factor, number[]> = { O: [], C: [], E: [], A: [], ES: [] };
  let answered = 0;
  for (const a of answers) {
    const f = FACTOR_OF[a.question_id];
    if (!f) continue;
    if (a.value < 1 || a.value > 5) continue;
    const v = REVERSE_OF[a.question_id] ? 6 - a.value : a.value;
    buckets[f].push(v);
    answered++;
  }
  const norm = (arr: number[]) =>
    arr.length ? Math.round((((arr.reduce((s, v) => s + v, 0) / arr.length) - 1) / 4) * 100) : 50;
  return {
    O: norm(buckets.O),
    C: norm(buckets.C),
    E: norm(buckets.E),
    A: norm(buckets.A),
    ES: norm(buckets.ES),
    answered,
  };
}

/** Веса факторов (для S5-сравнения пар). Сумма = 1. */
export const FACTOR_WEIGHTS: Record<Factor, number> = { C: 0.25, A: 0.25, ES: 0.25, E: 0.15, O: 0.1 };
