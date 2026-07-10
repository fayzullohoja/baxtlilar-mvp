import { describe, it, expect } from "vitest";
import { computeVector } from "./scoring";
import { QUESTIONS } from "./questions";

describe("computeVector (Big Five 5×direct+reverse, ревью оунера 2026-07-10)", () => {
  it("consistent-high (direct=5, reverse=1) → все факторы 100", () => {
    const answers = QUESTIONS.map((q) => ({ question_id: q.id, value: q.reverse ? 1 : 5 }));
    const v = computeVector(answers);
    expect(v.answered).toBe(10);
    expect(v.O).toBe(100);
    expect(v.C).toBe(100);
    expect(v.E).toBe(100);
    expect(v.A).toBe(100);
    expect(v.ES).toBe(100);
  });
  it("consistent-low (direct=1, reverse=5) → все факторы 0", () => {
    const v = computeVector(QUESTIONS.map((q) => ({ question_id: q.id, value: q.reverse ? 5 : 1 })));
    expect(v.A).toBe(0);
    expect(v.O).toBe(0);
    expect(v.ES).toBe(0);
  });
  it("все 3 → 50 (нейтрально, reverse не смещает)", () => {
    const v = computeVector(QUESTIONS.map((q) => ({ question_id: q.id, value: 3 })));
    expect(v.C).toBe(50);
    expect(v.O).toBe(50);
  });
  it("reverse-вопрос инвертируется: q2 (O reverse) value=1 → O=100", () => {
    const v = computeVector([{ question_id: "q2", value: 1 }]); // 6-1=5 → (5-1)/4*100
    expect(v.O).toBe(100);
    expect(v.answered).toBe(1);
  });
  it("фактор без ответов = 50 (нейтр.)", () => {
    const v = computeVector([{ question_id: "q1", value: 5 }]); // только O direct
    expect(v.O).toBe(100);
    expect(v.A).toBe(50);
    expect(v.answered).toBe(1);
  });
  it("игнорирует мусор + out-of-range", () => {
    const v = computeVector([
      { question_id: "nope", value: 5 },
      { question_id: "q5", value: 9 },
      { question_id: "q5", value: 4 }, // E direct
    ]);
    expect(v.answered).toBe(1);
    expect(v.E).toBe(75); // (4-1)/4*100
  });
});
