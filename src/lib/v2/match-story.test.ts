import { describe, it, expect } from "vitest";
import { generateMatchStory, type ProfileForMatch } from "./match-story";

function profile(overrides: Partial<ProfileForMatch> = {}): ProfileForMatch {
  return {
    display_name: "Тест",
    city: "tashkent",
    top_life_values: [],
    birth_date: "1995-01-01",
    marital_status: "never",
    has_children: "no",
    future_children_plan: "with_partner_decide",
    religion: "islam",
    religion_practice: "striving",
    education: "higher",
    bio: "тест",
    partner_age_min: 25,
    partner_age_max: 35,
    geo_preference: "country",
    vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
    ...overrides,
  };
}

describe("generateMatchStory — reasons (positive overlap)", () => {
  it("2+ общих top_life_values → reason про ключевые ценности", () => {
    const v = profile({ top_life_values: ["family", "education", "honesty"] });
    const c = profile({ top_life_values: ["family", "education", "independence"] });
    const story = generateMatchStory(v, c);
    expect(story.reasons[0]).toMatch(/совпадают ключевые ценности/i);
  });

  it("1 общая value → reason про одну ценность в singular tone", () => {
    const v = profile({ top_life_values: ["family", "career"] });
    const c = profile({ top_life_values: ["family", "independence"] });
    const story = generateMatchStory(v, c);
    expect(story.reasons[0]).toMatch(/вас обоих волнует одно/i);
  });

  it("совпавшая религия + близкая практика (gap ≤1) → reason про вероисповедание", () => {
    const v = profile({ religion: "islam", religion_practice: "striving" });
    const c = profile({ religion: "islam", religion_practice: "observant", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("вероисповеданию"))).toBe(true);
  });

  it("ИСЛАМ + null practice у одной стороны → reason всё равно даётся", () => {
    const v = profile({ religion: "islam", religion_practice: null });
    const c = profile({ religion: "islam", religion_practice: "observant", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("вероисповеданию"))).toBe(true);
  });

  it("оба хотят детей (yes_soon/yes_later) → reason про детей", () => {
    const v = profile({ future_children_plan: "yes_soon", top_life_values: [] });
    const c = profile({ future_children_plan: "yes_later", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("видите будущее с детьми"))).toBe(true);
  });

  it("оба НЕ хотят детей (no) → reason про редкое совпадение", () => {
    const v = profile({ future_children_plan: "no", top_life_values: [] });
    const c = profile({ future_children_plan: "no", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("не планируете"))).toBe(true);
  });

  it("близкий психо-вектор (avg diff <18) → reason про личность", () => {
    const v = profile({
      vector: { O: 60, C: 50, E: 55, A: 60, ES: 50 },
      top_life_values: [],
      religion: "na",
      future_children_plan: "maybe",
    });
    const c = profile({
      vector: { O: 65, C: 55, E: 60, A: 65, ES: 55 },
      top_life_values: [],
      religion: "na",
      future_children_plan: "maybe",
    });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("личностная структура"))).toBe(true);
  });

  it("reasons capped at 3", () => {
    const v = profile({
      top_life_values: ["family", "education", "honesty"],
      religion: "islam",
      religion_practice: "striving",
      future_children_plan: "yes_later",
      vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
      city: "tashkent",
    });
    const c = profile({
      top_life_values: ["family", "education", "honesty"],
      religion: "islam",
      religion_practice: "striving",
      future_children_plan: "yes_later",
      vector: { O: 51, C: 51, E: 51, A: 51, ES: 51 },
      city: "tashkent",
    });
    const story = generateMatchStory(v, c);
    expect(story.reasons.length).toBeLessThanOrEqual(3);
  });
});

describe("generateMatchStory — cautions (friction)", () => {
  it("yes_soon vs no → caution про детей", () => {
    const v = profile({ future_children_plan: "yes_soon" });
    const c = profile({ future_children_plan: "no" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("детей"))).toBe(true);
  });

  it("разрыв в религиозной практике ≥2 уровня → caution", () => {
    const v = profile({ religion_practice: "not_practicing" });
    const c = profile({ religion_practice: "observant" });
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
      future_children_plan: "yes_soon",
      religion_practice: "not_practicing",
      city: "tashkent",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 30,
      birth_date: "1995-01-01",
    });
    const c = profile({
      future_children_plan: "no",
      religion_practice: "observant",
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
    const v = profile({ top_life_values: ["family"] });
    const c = profile({ top_life_values: ["family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/традиции/i);
  });

  it("при общей value 'education' → совет про обучение", () => {
    const v = profile({ top_life_values: ["education"] });
    const c = profile({ top_life_values: ["education"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/изучает|научиться/i);
  });

  it("нет общих values → advice null", () => {
    const v = profile({ top_life_values: ["career"] });
    const c = profile({ top_life_values: ["family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toBeNull();
  });

  it("берётся первая общая value (приоритет порядка viewer)", () => {
    const v = profile({ top_life_values: ["family", "honesty"] });
    const c = profile({ top_life_values: ["honesty", "family"] });
    const story = generateMatchStory(v, c);
    expect(story.advice).toMatch(/традиции/i);
  });
});
