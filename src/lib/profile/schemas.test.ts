import { describe, it, expect } from "vitest";
import {
  ageFromDate,
  containsContact,
  basicSchema,
  valuesSchema,
  lookingForSchema,
} from "./schemas";

describe("ageFromDate", () => {
  it("18+ для давней даты", () => {
    expect(ageFromDate("1995-01-01")).toBeGreaterThanOrEqual(18);
  });
  it("младенец < 18", () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 5);
    expect(ageFromDate(recent.toISOString().slice(0, 10))).toBeLessThan(18);
  });
});

describe("containsContact", () => {
  it("ловит телефон", () => expect(containsContact("пиши +998 90 123 45 67")).toBe(true));
  it("ловит телефон без разделителей", () => expect(containsContact("998901234567")).toBe(true));
  it("ловит цифры через пробелы", () => expect(containsContact("9 0 1 2 3 4 5 6 7")).toBe(true));
  it("ловит @username", () => expect(containsContact("мой тг @ali_2024")).toBe(true));
  it("ловит ссылку", () => expect(containsContact("сайт example.com")).toBe(true));
  it("ловит мессенджер по названию", () => expect(containsContact("пиши в telegram")).toBe(true));
  it("чистый текст ок", () =>
    expect(containsContact("Люблю горы, книги и спокойные вечера дома")).toBe(false));
  // регрессии: легитимные числа/диапазоны НЕ должны блокироваться
  it("год не блокируется", () => expect(containsContact("Мне 1995 года рождения")).toBe(false));
  it("диапазон лет не блокируется", () => expect(containsContact("диплом 2018-2022 годов")).toBe(false));
  it("диапазон дохода не блокируется", () =>
    expect(containsContact("Доход 3 000 000 - 5 000 000 сум")).toBe(false));
  it("слово 'инстинкт' не ложноблок", () =>
    expect(containsContact("ценю инстинкт самосохранения")).toBe(false));
});

describe("basicSchema", () => {
  const ok = {
    display_name: "Алишер",
    gender: "m",
    birth_date: "1994-05-10",
    city: "toshkent",
    bio: "Спокойный, ценю семью и честность, люблю готовить и путешествовать",
  };
  it("валидная анкета", () => expect(basicSchema.safeParse(ok).success).toBe(true));
  it("город вне справочника → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, city: "Ташкент" }).success).toBe(false));
  it("несовершеннолетний → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, birth_date: "2015-01-01" }).success).toBe(false));
  it("bio с телефоном → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, bio: "звони 998901234567 хороший человек тут" }).success).toBe(
      false,
    ));
  it("короткий bio → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, bio: "привет" }).success).toBe(false));
});

describe("valuesSchema", () => {
  const base = { religion: "islam", religion_importance: 5, education: "higher", values: ["family"] };
  it("1-3 ценности ок", () => expect(valuesSchema.safeParse(base).success).toBe(true));
  it("4 ценности → ошибка", () =>
    expect(
      valuesSchema.safeParse({ ...base, values: ["family", "faith", "health", "growth"] }).success,
    ).toBe(false));
  it("0 ценностей → ошибка", () =>
    expect(valuesSchema.safeParse({ ...base, values: [] }).success).toBe(false));
  it("importance вне 1-5 → ошибка", () =>
    expect(valuesSchema.safeParse({ ...base, religion_importance: 7 }).success).toBe(false));
});

describe("lookingForSchema", () => {
  const base = { partner_age_min: 22, partner_age_max: 30, geo_preference: "my_city" };
  it("корректный диапазон ок", () => expect(lookingForSchema.safeParse(base).success).toBe(true));
  it("min>max → ошибка", () =>
    expect(lookingForSchema.safeParse({ ...base, partner_age_min: 35 }).success).toBe(false));
  it("<18 → ошибка", () =>
    expect(lookingForSchema.safeParse({ ...base, partner_age_min: 16 }).success).toBe(false));
});
