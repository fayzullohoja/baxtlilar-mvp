// Чистая функция скоринга кандидата для ленты (тестируемая, без IO).
export type ScoreInput = {
  age: number;
  city: string;
  values: string[];
  vector: Record<string, number>; // {O,C,E,A,ES} 0..100
};

const FACTORS = ["O", "C", "E", "A", "ES"] as const;

/**
 * Чем выше — тем релевантнее. Складываем: совпадение города, общие ценности (до 3),
 * близость психо-вектора, близость возраста. Диапазон ~0..100+.
 */
export function scoreCandidate(viewer: ScoreInput, cand: ScoreInput): number {
  let score = 0;

  if (viewer.city && cand.city && viewer.city.trim().toLowerCase() === cand.city.trim().toLowerCase()) {
    score += 30;
  }

  const shared = viewer.values.filter((v) => cand.values.includes(v)).length;
  score += Math.min(shared, 3) * 10;

  // близость векторов: 100 - средняя |разница| по факторам (если есть данные)
  const diffs = FACTORS.map((f) => {
    const a = viewer.vector[f];
    const b = cand.vector[f];
    return typeof a === "number" && typeof b === "number" ? Math.abs(a - b) : null;
  }).filter((x): x is number => x !== null);
  if (diffs.length) {
    const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    score += Math.round((100 - avg) * 0.4);
  }

  // близость возраста: чем меньше разница, тем больше (до +20)
  score += Math.max(0, 20 - Math.abs(viewer.age - cand.age));

  return score;
}
