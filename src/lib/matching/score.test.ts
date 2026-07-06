import { describe, it, expect } from "vitest";
import { scoreCandidate, type ScoreInput } from "./score";

const base: ScoreInput = { age: 30, city: "Ташкент", values: ["family", "faith"], vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 } };

describe("scoreCandidate", () => {
  it("совпадение города повышает счёт", () => {
    const same = scoreCandidate(base, { ...base });
    const diff = scoreCandidate(base, { ...base, city: "Самарканд" });
    expect(same).toBeGreaterThan(diff);
  });
  it("общие ценности повышают счёт", () => {
    const shared = scoreCandidate(base, { ...base, values: ["family", "faith"] });
    const none = scoreCandidate(base, { ...base, values: ["career", "freedom"] });
    expect(shared).toBeGreaterThan(none);
  });
  it("близкий вектор лучше далёкого", () => {
    const near = scoreCandidate(base, { ...base, vector: { O: 55, C: 50, E: 50, A: 50, ES: 50 } });
    const far = scoreCandidate(base, { ...base, vector: { O: 0, C: 0, E: 0, A: 0, ES: 0 } });
    expect(near).toBeGreaterThan(far);
  });
  it("близкий возраст лучше далёкого", () => {
    const near = scoreCandidate(base, { ...base, age: 31 });
    const far = scoreCandidate(base, { ...base, age: 55 });
    expect(near).toBeGreaterThan(far);
  });
  it("лимит общих ценностей — максимум 3, полное совпадение (без землячества) = 120", () => {
    const v: ScoreInput = { ...base, values: ["a", "b", "c", "d", "e"] };
    const c: ScoreInput = { ...base, values: ["a", "b", "c", "d", "e"] };
    // city + 3*10 + vector(=100*0.4=40) + age(20) = 30+30+40+20 = 120
    expect(scoreCandidate(v, c)).toBe(120);
  });

  // --- гео по региону (city в V4 мёртв) ---
  it("совпадение региона даёт гео-бонус даже без города", () => {
    const viewer: ScoreInput = { age: 30, region: "tashkent_region", values: [], vector: {} };
    const same = scoreCandidate(viewer, { age: 30, region: "tashkent_region", values: [], vector: {} });
    const diff = scoreCandidate(viewer, { age: 30, region: "samarkand_region", values: [], vector: {} });
    expect(same - diff).toBe(30);
  });

  // --- Кадр 15: землячество (регион рождения) как мягкий фактор ---
  it("совпадение региона рождения даёт мягкий бонус (+10)", () => {
    const viewer: ScoreInput = { age: 30, birthRegion: "fergana", values: [], vector: {} };
    const zemlyak = scoreCandidate(viewer, { age: 30, birthRegion: "fergana", values: [], vector: {} });
    const other = scoreCandidate(viewer, { age: 30, birthRegion: "khorezm", values: [], vector: {} });
    expect(zemlyak - other).toBe(10);
  });
  it("несовпадение региона рождения НЕ штрафует (землячество — soft)", () => {
    const viewer: ScoreInput = { age: 30, birthRegion: "fergana", values: [], vector: {} };
    const other = scoreCandidate(viewer, { age: 30, birthRegion: "khorezm", values: [], vector: {} });
    const noBirth = scoreCandidate(viewer, { age: 30, values: [], vector: {} });
    expect(other).toBe(noBirth);
  });

  // --- FACTOR_WEIGHTS: расхождение по весомому фактору (C) бьёт сильнее, чем по лёгкому (O) ---
  it("расхождение по C (вес 0.25) хуже, чем по O (вес 0.1)", () => {
    const viewer: ScoreInput = { age: 30, values: [], vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 } };
    const diffC = scoreCandidate(viewer, { age: 30, values: [], vector: { O: 50, C: 90, E: 50, A: 50, ES: 50 } });
    const diffO = scoreCandidate(viewer, { age: 30, values: [], vector: { O: 90, C: 50, E: 50, A: 50, ES: 50 } });
    expect(diffO).toBeGreaterThan(diffC);
  });

  // --- confidence-blend: анкета без квиза не проваливается вниз (bury-баг) ---
  it("без квиза вклад личности = нейтраль (не 0)", () => {
    const noQuizPair = scoreCandidate(
      { age: 30, values: [], vector: {} },
      { age: 30, values: [], vector: {} },
    );
    // гео/ценности 0, возраст +20, вектор-нейтраль +20 → 40
    expect(noQuizPair).toBe(40);
  });
  it("quiz-less кандидат обгоняет максимально несовместимого по личности", () => {
    const viewer: ScoreInput = { age: 30, values: [], vector: { O: 100, C: 100, E: 100, A: 100, ES: 100 } };
    const noQuiz = scoreCandidate(viewer, { age: 30, values: [], vector: {} });
    const opposite = scoreCandidate(viewer, { age: 30, values: [], vector: { O: 0, C: 0, E: 0, A: 0, ES: 0 } });
    expect(noQuiz).toBeGreaterThan(opposite);
  });
});
