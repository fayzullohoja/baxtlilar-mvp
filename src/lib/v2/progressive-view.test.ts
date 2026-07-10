import { test, expect } from "vitest";
import { toProgressiveView } from "./progressive-view";
import type { ProfileForMatch } from "./match-story";

const full: ProfileForMatch = {
  display_name: "Zayniddin Hamroyev",
  city: "Ташкент",
  top_life_values: ["family", "respect"],
  birth_date: "1990-05-15",
  marital_status: "never",
  has_children: "no",
  future_children_plan: "yes_later",
  religion: "islam",
  education: "higher",
  bio: "Люблю книги",
  partner_age_min: 22,
  partner_age_max: 32,
  geo_preference: "same_city",
  vector: { O: 70 },
};

test("first_name — только первое слово (фамилия скрыта)", () => {
  expect(toProgressiveView(full).first_name).toBe("Zayniddin");
});

test("payload содержит РОВНО разрешённые pre-mutual поля — ничего лишнего", () => {
  const view = toProgressiveView(full);
  expect(Object.keys(view).sort()).toEqual(
    ["bio", "city", "education", "first_name", "top_life_values", "vector"].sort(),
  );
});

test("не утекают чувствительные поля (точный DOB, статус, дети, предпочтения, фамилия, религия)", () => {
  const view = toProgressiveView(full);
  const json = JSON.stringify(view);
  expect(json).not.toContain("1990-05-15"); // точная дата рождения
  expect(json).not.toContain("Hamroyev"); // фамилия
  expect(json).not.toContain("islam"); // вероисповедание — matching-only, не в pre-mutual payload
  const leaked = view as unknown as Record<string, unknown>;
  expect(leaked.birth_date).toBeUndefined();
  expect(leaked.marital_status).toBeUndefined();
  expect(leaked.has_children).toBeUndefined();
  expect(leaked.future_children_plan).toBeUndefined();
  expect(leaked.partner_age_min).toBeUndefined();
  expect(leaked.partner_age_max).toBeUndefined();
  expect(leaked.geo_preference).toBeUndefined();
  expect(leaked.display_name).toBeUndefined();
  // Религия УБРАНА из pre-mutual view (ревью оунера 2026-07-10 — спец-категория ПД).
  expect(leaked.religion).toBeUndefined();
});

test("сохраняет разрешённые поля (город, образование, ценности, bio, vector)", () => {
  const view = toProgressiveView(full);
  expect(view.city).toBe("Ташкент");
  expect(view.education).toBe("higher");
  expect(view.top_life_values).toEqual(["family", "respect"]);
  expect(view.bio).toBe("Люблю книги");
  expect(view.vector).toEqual({ O: 70 });
});
