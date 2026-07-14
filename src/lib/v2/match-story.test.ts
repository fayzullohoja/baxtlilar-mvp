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
    education: "higher",
    bio: "тест",
    partner_age_min: 25,
    partner_age_max: 35,
    geo_preference: "country",
    vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
    ...overrides };
}

describe("generateMatchStory — редактируемые лейблы ценностей (Tier 2)", () => {
  // Лейблы ценностей в match-story должны браться из ПЕРЕДАННОГО резолвера
  // (Options.LIFE_VALUES_V3.* — правится в админке). Без инъекции история
  // молча показывала бы старый лейбл из кода.
  it("использует переданный резолвер лейблов (2+ совпадения)", () => {
    const v = profile({ top_life_values: ["family", "education", "honesty"] });
    const c = profile({ top_life_values: ["family", "education", "independence"] });
    const story = generateMatchStory(v, c, 0, (val) => `LBL_${val}`);
    expect(story.reasons[0]).toContain("lbl_family");
    expect(story.reasons[0]).toContain("lbl_education");
  });

  it("использует переданный резолвер и при единственном совпадении", () => {
    const v = profile({ top_life_values: ["faith"] });
    const c = profile({ top_life_values: ["faith"] });
    const story = generateMatchStory(v, c, 0, (val) => `LBL_${val}`);
    expect(story.reasons[0]).toContain("lbl_faith");
  });

  it("без резолвера — базовые лейблы из options.ts (обратная совместимость)", () => {
    const v = profile({ top_life_values: ["family", "honesty"] });
    const c = profile({ top_life_values: ["family", "honesty"] });
    const story = generateMatchStory(v, c);
    expect(story.reasons[0]).toContain("семья"); // базовый ru, lowercase-нут
  });
});

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
    expect(story.reasons[0]).toMatch(/Вас обоих волнует одно/i);
  });

  // 2026-07-12 (privacy fix, owner A4): вероисповедание и планы на детей —
  // post-mutual поля (progressive-view их НЕ отдаёт на клиент). Story НЕ должна
  // раскрывать их до взаимного интереса — иначе зритель пиннит значение кандидата.
  it("совпавшая религия НЕ даёт pre-mutual reason (спец-ПД)", () => {
    const v = profile({ religion: "islam", top_life_values: [] });
    const c = profile({ religion: "islam", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("вероисповеданию"))).toBe(false);
  });

  it("совпавшие планы на детей НЕ дают pre-mutual reason", () => {
    const v = profile({ future_children_plan: "yes_soon", top_life_values: [] });
    const c = profile({ future_children_plan: "yes_later", top_life_values: [] });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => /детьми|не планируете/.test(r))).toBe(false);
  });

  it("близкий психо-вектор (avg diff <18) → reason про личность", () => {
    const v = profile({
      vector: { O: 60, C: 50, E: 55, A: 60, ES: 50 },
      top_life_values: [],
      religion: "na",
      future_children_plan: "maybe" });
    const c = profile({
      vector: { O: 65, C: 55, E: 60, A: 65, ES: 55 },
      top_life_values: [],
      religion: "na",
      future_children_plan: "maybe" });
    const story = generateMatchStory(v, c);
    expect(story.reasons.some((r) => r.includes("личностная структура"))).toBe(true);
  });

  it("reasons capped at 3", () => {
    const v = profile({
      top_life_values: ["family", "education", "honesty"],
      religion: "islam",
      future_children_plan: "yes_later",
      vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
      city: "tashkent" });
    const c = profile({
      top_life_values: ["family", "education", "honesty"],
      religion: "islam",
      future_children_plan: "yes_later",
      vector: { O: 51, C: 51, E: 51, A: 51, ES: 51 },
      city: "tashkent" });
    const story = generateMatchStory(v, c);
    expect(story.reasons.length).toBeLessThanOrEqual(3);
  });
});

describe("generateMatchStory — cautions (friction)", () => {
  // 2026-07-12 (privacy fix, owner A4): конфликт по детям (future_children_plan)
  // и гео-предпочтение (geo_preference) — post-mutual поля; caution по ним
  // раскрывал значение кандидата до мэтча. Убраны из pre-mutual story.
  it("конфликт по детям НЕ даёт pre-mutual caution", () => {
    const v = profile({ future_children_plan: "yes_soon" });
    const c = profile({ future_children_plan: "no" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("детей"))).toBe(false);
  });

  it("разные города + оба my_city НЕ даёт caution (geo_preference post-mutual)", () => {
    const v = profile({ city: "tashkent", geo_preference: "my_city" });
    const c = profile({ city: "samarkand", geo_preference: "my_city" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("разных городах"))).toBe(false);
  });

  it("кандидат вне partner_age диапазона viewer → caution про возраст", () => {
    const v = profile({
      partner_age_min: 25,
      partner_age_max: 30,
      birth_date: "1995-01-01" });
    const c = profile({
      partner_age_min: 25,
      partner_age_max: 40,
      birth_date: "1990-01-01" });
    const story = generateMatchStory(v, c);
    expect(story.cautions.some((c) => c.includes("Возраст"))).toBe(true);
  });

  it("cautions capped at 2", () => {
    const v = profile({
      future_children_plan: "yes_soon",
      city: "tashkent",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 30,
      birth_date: "1995-01-01" });
    const c = profile({
      future_children_plan: "no",
      city: "samarkand",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 40,
      birth_date: "1990-01-01" });
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

// MATCH-3 — honest story при relax-уровнях: не утверждаем возрастное
// совпадение, честно говорим что расширили диапазон.
describe("generateMatchStory — relaxLevel honesty", () => {
  it("relaxLevel=1 → caution про расширенный возрастной диапазон", () => {
    const v = profile({ partner_age_min: 25, partner_age_max: 25, birth_date: "1996-01-01" });
    const c = profile({ birth_date: "1991-01-01" }); // ~35 — вне строгого окна
    const story = generateMatchStory(v, c, 1);
    expect(story.cautions.some((x) => /расширили возрастной/i.test(x))).toBe(true);
  });

  it("relax-note вытесняет generic «возраст слегка вне диапазона» (не дублируем)", () => {
    const v = profile({ partner_age_min: 25, partner_age_max: 25, birth_date: "1996-01-01" });
    const c = profile({ birth_date: "1991-01-01" });
    const story = generateMatchStory(v, c, 2);
    expect(story.cautions.filter((x) => /возраст/i.test(x))).toHaveLength(1);
    expect(story.cautions.some((x) => /слегка вне диапазона/i.test(x))).toBe(false);
  });

  it("relax-note не теряется из-за slice(0,2) при других cautions", () => {
    const v = profile({
      future_children_plan: "yes_soon",
      city: "tashkent",
      geo_preference: "my_city",
      partner_age_min: 25,
      partner_age_max: 25,
      birth_date: "1996-01-01",
    });
    const c = profile({
      future_children_plan: "no",
      city: "samarkand",
      geo_preference: "my_city",
      birth_date: "1991-01-01",
    });
    const story = generateMatchStory(v, c, 1);
    expect(story.cautions.some((x) => /расширили возрастной/i.test(x))).toBe(true);
    expect(story.cautions.length).toBeLessThanOrEqual(2);
  });

  it("relaxLevel=0 (и по умолчанию) → поведение прежнее, без relax-note", () => {
    const v = profile({ partner_age_min: 25, partner_age_max: 40 });
    const c = profile();
    expect(generateMatchStory(v, c, 0)).toEqual(generateMatchStory(v, c));
    const all = [...generateMatchStory(v, c).cautions, ...generateMatchStory(v, c).reasons];
    expect(all.some((x) => /расширили возрастной/i.test(x))).toBe(false);
  });
});
