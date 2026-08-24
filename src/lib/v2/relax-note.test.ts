import { describe, it, expect } from "vitest";
import { generateMatchStory, type ProfileForMatch } from "./match-story";

/**
 * Замечание 10 тестеров family launch: женщина указала 25-32, а в подборе
 * увидела людей вне этого диапазона, и решила, что фильтр сломан.
 *
 * Фильтр не сломан - работает лестница ослабления: когда строгих кандидатов
 * нет, диапазон раздвигается на пять лет в обе стороны. Проблема была в том,
 * что продукт об этом молчал: текст говорил «немного расширили» и чисел не
 * называл, поэтому вопрос оставался без ответа.
 *
 * Тест держит именно ответ на вопрос человека: в подсказке обязаны быть и
 * исходные рамки, и фактические.
 */
function profile(over: Partial<ProfileForMatch>): ProfileForMatch {
  return {
    display_name: "Тест",
    city: "tashkent",
    top_life_values: ["family"],
    birth_date: "1990-01-01",
    marital_status: "never",
    has_children: null,
    future_children_plan: "want",
    religion: "islam",
    education: "higher",
    bio: null,
    partner_age_min: 25,
    partner_age_max: 32,
    geo_preference: null,
    vector: { O: 50, C: 50, E: 50, A: 50, ES: 50 },
    ...over,
  };
}

const viewer = profile({ birth_date: "1996-05-10", partner_age_min: 25, partner_age_max: 32 });
const cand = profile({ birth_date: "1988-03-02", partner_age_min: 20, partner_age_max: 45 });

describe("подсказка про расширенный поиск", () => {
  it("называет и исходный диапазон, и фактический", () => {
    const story = generateMatchStory(viewer, cand, 1);
    const note = story.cautions.find((c) => c.includes("расширили"));
    expect(note, "подсказки о расширении нет вовсе").toBeTruthy();
    expect(note, "не названы исходные рамки, которые ставил человек").toContain("25-32");
    expect(note, "не названы фактические рамки поиска").toContain("20-37");
  });

  it("нижняя граница не опускается ниже 18", () => {
    const young = profile({ partner_age_min: 20, partner_age_max: 25 });
    const story = generateMatchStory(young, cand, 1);
    const note = story.cautions.find((c) => c.includes("расширили"))!;
    expect(note).toContain("18-30");
  });

  it("при строгом подборе подсказки о расширении нет", () => {
    const story = generateMatchStory(viewer, cand, 0);
    expect(story.cautions.some((c) => c.includes("расширили"))).toBe(false);
  });

  it("подсказка не вытесняется другими и идёт первой", () => {
    const story = generateMatchStory(viewer, cand, 2);
    expect(story.cautions[0]).toContain("расширили");
  });
});
