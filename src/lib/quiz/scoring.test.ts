import { describe, it, expect } from "vitest";
import { computeVector } from "./scoring";
import { QUESTIONS } from "./questions";

describe("computeVector", () => {
  it("все 5 → факторы 100", () => {
    const answers = QUESTIONS.map((q) => ({ question_id: q.id, value: 5 }));
    const v = computeVector(answers);
    expect(v.answered).toBe(10);
    expect(v.A).toBe(100);
    expect(v.ES).toBe(100);
    expect(v.C).toBe(100);
  });
  it("все 1 → факторы 0", () => {
    const v = computeVector(QUESTIONS.map((q) => ({ question_id: q.id, value: 1 })));
    expect(v.A).toBe(0);
    expect(v.O).toBe(0);
  });
  it("среднее 3 → 50", () => {
    const v = computeVector(QUESTIONS.map((q) => ({ question_id: q.id, value: 3 })));
    expect(v.C).toBe(50);
  });
  it("фактор без ответов = 50 (нейтр.)", () => {
    const v = computeVector([{ question_id: "q1", value: 5 }]); // только O
    expect(v.O).toBe(100);
    expect(v.A).toBe(50);
    expect(v.answered).toBe(1);
  });
  it("игнорирует мусор", () => {
    const v = computeVector([
      { question_id: "nope", value: 5 },
      { question_id: "q5", value: 9 },
      { question_id: "q5", value: 4 },
    ]);
    expect(v.answered).toBe(1);
    expect(v.A).toBe(75); // (4-1)/4*100
  });
});
