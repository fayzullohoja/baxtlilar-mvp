// Чистая функция скоринга кандидата для ленты (тестируемая, без IO).
export type ScoreInput = {
  age: number;
  /** Регион проживания — основной гео-сигнал (в V4 колонка city не заполняется). */
  region?: string | null;
  /** Город — legacy; в V4 не пишется, оставлен для обратной совместимости. */
  city?: string | null;
  /** Регион рождения — мягкое «землячество» (soft-бонус, без штрафа). */
  birthRegion?: string | null;
  values: string[];
  vector: Record<string, number>; // {O,C,E,A,ES} 0..100
};

const FACTORS = ["O", "C", "E", "A", "ES"] as const;

// Веса личностных факторов Big Five (сумма = 1). Сознательность / доброжелательность /
// эмоц. стабильность для брака предсказательнее, чем открытость / экстраверсия.
const FACTOR_WEIGHTS: Record<(typeof FACTORS)[number], number> = {
  C: 0.25,
  A: 0.25,
  ES: 0.25,
  E: 0.15,
  O: 0.1,
};

const VECTOR_MAX = 40; // максимум вклада личности
const VECTOR_NEUTRAL = VECTOR_MAX / 2; // нейтральная база при отсутствии квиза (confidence-blend)

function sameText(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Чем выше — тем релевантнее. Складываем: гео (регион/город), землячество (регион
 * рождения, soft), общие ценности (до 3), близость Big Five, близость возраста.
 * Диапазон 0..130.
 *
 * Личность: взвешенное по FACTOR_WEIGHTS среднее |diff| по факторам, ПРИСУТСТВУЮЩИМ
 * у обоих; результат смешивается с нейтральной базой пропорционально «уверенности»
 * (доле присутствующих весов). Без квиза вклад = нейтраль (VECTOR_NEUTRAL), а не 0 —
 * иначе анкеты без психо-портрета молча проваливались вниз (bury-баг).
 */
export function scoreCandidate(viewer: ScoreInput, cand: ScoreInput): number {
  let score = 0;

  // Гео: совпал регион проживания (или город, если вдруг заполнен) → +30.
  if (sameText(viewer.region, cand.region) || sameText(viewer.city, cand.city)) {
    score += 30;
  }

  // Землячество: совпал регион рождения → мягкий бонус, без штрафа за несовпадение.
  if (sameText(viewer.birthRegion, cand.birthRegion)) {
    score += 10;
  }

  // Общие ценности (до 3). Дедуп viewer.values — дубликаты не должны раздувать счёт.
  const shared = [...new Set(viewer.values)].filter((v) => cand.values.includes(v)).length;
  score += Math.min(shared, 3) * 10;

  // Личность (Big Five): веса FACTOR_WEIGHTS + confidence-blend к нейтрали.
  let presentWeight = 0;
  let weightedDiff = 0;
  for (const f of FACTORS) {
    const a = viewer.vector[f];
    const b = cand.vector[f];
    if (typeof a === "number" && typeof b === "number") {
      const w = FACTOR_WEIGHTS[f];
      presentWeight += w;
      weightedDiff += Math.abs(a - b) * w;
    }
  }
  const confidence = presentWeight; // сумма весов всех факторов = 1
  const computed = presentWeight ? (100 - weightedDiff / presentWeight) * (VECTOR_MAX / 100) : 0;
  score += Math.round(confidence * computed + (1 - confidence) * VECTOR_NEUTRAL);

  // Близость возраста (до +20).
  score += Math.max(0, 20 - Math.abs(viewer.age - cand.age));

  return score;
}
