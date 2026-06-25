import { describe, it, expect } from "vitest";
import { generateMatchStory, type ProfileForMatch } from "./match-story";

function profile(overrides: Partial<ProfileForMatch> = {}): ProfileForMatch {
  return {
    display_name: "Тест",
    city: "tashkent",
    values: [],
    birth_date: "1995-01-01",
    marital_status: "never",
    has_children: "no",
    children_plan: "open",
    religion: "islam",
    religion_importance: 3,
    education: "higher",
    employment: "full",
    bio: "тест",
    partner_age_min: 25,
    partner_age_max: 35,
    geo_preference: "country",
    vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
    ...overrides,
  };
}

describe("generateMatchStory — reasons (positive overlap)", () => {
  it("2+ общих values → reason про ключевые ценности", () => {
    const v = profile({ values: ["family", "growth", "honesty"] });
    const c = profile({ values: ["family", "growth", "freedom"] });
    const story = generateMatchStory(v, c);
    expect(story.reasons[0]).toMatch(/совпадают ключевые ценности/i);
  });

  it("1 общая value → reason про одну ценность в singular tone", () => {
    const v = profile({ values: ["family", "career"] });
    const c = profile({ values: ["family", "freedom"] });
    const story = generateMatchStory(v, c);
    expect(story.reasons[0]).toMatch(/вас обоих волнует одно/i);
  });

  it("совпавшая религия + близкая важность (≤1) → reason про вероисповедание", () => {
    const v = profile({ religion: "islam", religion_importance: 4 });
    const c = profile({ religion: "islam", religion_importance: 5, values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("вероисповеданию"))).toBe(true);
  });

  it("ИСЛАМ + 'na' importance у одной стороны → reason всё равно даётся (impGap=null)", () => {
    const v = profile({ religion: "islam", religion_importance: null });
    const c = profile({ religion: "islam", religion_importance: 5, values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("вероисповеданию"))).toBe(true);
  });

  it("оба хотят детей (want/open) → reason про детей", () => {
    const v = profile({ children_plan: "want", values: [] });
    const c = profile({ children_plan: "open", values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("видите будущее с детьми"))).toBe(true);
  });

  it("оба НЕ хотят детей (have_no_more) → reason про редкое совпадение", () => {
    const v = profile({ children_plan: "have_no_more", values: [] });
    const c = profile({ children_plan: "have_no_more", values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("не планируете"))).toBe(true);
  });

  it("близкий психо-вектор (avg diff <18) → reason про личность", () => {
    const v = profile({
      vector: { O: 60, C: 50, E: 55, A: 60, ES: 50 },
      values: [],
      religion: "na",
      children_plan: "unsure",
    });
    const c = profile({
      vector: { O: 65, C: 55, E: 60, A: 65, ES: 55 },
      values: [],
      religion: "na",
      children_plan: "unsure",
    });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("личностная структура"))).toBe(true);
  });

  it("reasons capped at 3", () => {
    const v = profile({
      values: ["family", "growth", "honesty"],
      religion: "islam",
      religion_importance: 4,
      children_plan: "want",
      vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
      city: "tashkent",
    });
    const c = profile({
      values: ["family", "growth", "honesty"],
      religion: "islam",
      religion_importance: 4,
      children_plan: "want",
      vector: { O: 51, C: 51, E: 51, A: 51, ES: 51 },
      city: "tashkent",
    });
    const story = generateMatchStory(v, c);
    expect(story.reasons.length).toBeLessThanOrEqual(3);
  });
});

describe("generateMatchStory — cautions (friction)", () => {
  it("want vs have_no_more → caution про детей", () => {
    const v = profile({ children_plan: "want" });
    const c = profile({ children_plan: "have_no_more" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("детей"))).toBe(true);
  });

  it("разрыв в важности религии ≥3 → caution", () => {
    const v = profile({ religion_importance: 1 });
    const c = profile({ religion_importance: 5 });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("Религия"))).toBe(true);
  });

  it("разные города + оба my_city → caution про разные города", () => {
    const v = profile({ city: "tashkent", geo_preference: "my_city" });
    const c = profile({ city: "samarkand", geo_preference: "my_city" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("разных городах"))).toBe(true);
  });

  it("разные города но один country-preference → НЕТ caution про города", () => {
    const v = profile({ city: "tashkent", geo_preference: "country" });
    const c = profile({ city: "samarkand", geo_preference: "my_city" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("разных городах"))).toBe(false);
  });

  it("кандидат вне partner_age диапазона viewer → caution про возраст", () => {
    // viewer хочет 25-30, кандидату 35
    const v = profile({
      partner_age_min: 25,
      partner_age_max: 30,
      birth_date: "1995-01-01",
    });
    const c = profile({
      partner_age_min: 25,
      partner_age_max: 40,
      birth_date: "1990-01-01",
    });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("Возраст"))).toBe(true);
  });

  it("cautions capped at 2", () => {
    const v = profile({
      children_plan: "want",
      religion_importance: 1,
      city: "tashkent",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 30,
      birth_date: "1995-01-01",
    });
    const c = profile({
      children_plan: "have_no_more",
      religion_importance: 5,
      city: "samarkand",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 40,
      birth_date: "1990-01-01",
    });
    const story = generateMatchStory(v, c);
    expect(story.cautions.length).toBeLessThanOrEqual(2);
  });
});

describe("generateMatchStory — advice", () => {
  it("при общей value 'family' → совет про традиции", () => {
    const v = profile({ values: ["family"] });
    const c = profile({ values: ["family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/традиции/i);
  });

  it("при общей value 'growth' → совет про обучение", () => {
    const v = profile({ values: ["growth"] });
    const c = profile({ values: ["growth"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/научиться|изучает/i);
  });

  it("нет общих values → advice null", () => {
    const v = profile({ values: ["career"] });
    const c = profile({ values: ["family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toBeNull();
  });

  it("берётся первая общая value (приоритет порядка viewer)", () => {
    const v = profile({ values: ["family", "honesty"] });
    const c = profile({ values: ["honesty", "family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/традиции/i); // family — первая у viewer
  });
});
