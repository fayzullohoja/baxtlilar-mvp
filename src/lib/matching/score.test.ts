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
  it("лимит общих ценностей — максимум 3", () => {
    const v: ScoreInput = { ...base, values: ["a", "b", "c", "d", "e"] };
    const c: ScoreInput = { ...base, values: ["a", "b", "c", "d", "e"] };
    // city + 3*10 + vector(=100*0.4=40) + age(20) = 30+30+40+20 = 120
    expect(scoreCandidate(v, c)).toBe(120);
  });
});
