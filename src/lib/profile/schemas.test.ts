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

  // F-009 v2 — обходы, которые раньше пропускались:
  it("v2: подчёркивания как разделитель → ловит", () =>
    expect(containsContact("звони 9_0_1_2_3_4_5_6_7")).toBe(true));
  it("v2: двойные пробелы между цифрами → ловит", () =>
    expect(containsContact("9  0  1 2 3 4 5 6 7")).toBe(true));
  it("v2: @cyrillic-username → ловит", () =>
    expect(containsContact("пиши @саша_2024")).toBe(true));
  it("v2: wa.link → ловит", () => expect(containsContact("открой wa.link/abc")).toBe(true));
  it("v2: linktr.ee → ловит", () => expect(containsContact("моя linktr.ee/ali")).toBe(true));
  it("v2: bit.ly → ловит", () => expect(containsContact("ссылка bit.ly/x")).toBe(true));
  it("v2: signal.app → ловит", () => expect(containsContact("я на signal.app")).toBe(true));
  it("v2: 'тг' слово → ловит", () => expect(containsContact("напиши в тг")).toBe(true));
  it("v2: 'телега' → ловит", () => expect(containsContact("моя телега алишер")).toBe(true));
  it("v2: 'инста' → ловит", () => expect(containsContact("инста @ali")).toBe(true));
  it("v2: signal → ловит", () => expect(containsContact("найди меня в signal")).toBe(true));
  it("v2: discord → ловит", () => expect(containsContact("кинь discord")).toBe(true));
  // не-ложноблок для регрессии после v2 расширения
  it("v2: 'тренировка инструмента' не ложноблок", () =>
    expect(containsContact("тренировка инструмента важна")).toBe(false));
  it("v2: 'легендарная' не ложноблок (содержит 'ег')", () =>
    expect(containsContact("это легендарная история")).toBe(false));
});

describe("basicSchema", () => {
  // V2 ext 2026-06-28: basic теперь включает citizenship + country_of_residence + region.
  // region обязателен только для UZ (country_of_residence='UZ' + region из UZ_REGIONS).
  const ok = {
    display_name: "Алишер",
    gender: "m",
    birth_date: "1994-05-10",
    citizenship: "UZ",
    country_of_residence: "UZ",
    region: "tashkent_city",
    city: "toshkent",
    bio: "Спокойный, ценю семью и честность, люблю готовить и путешествовать",
  };
  it("валидная анкета", () => expect(basicSchema.safeParse(ok).success).toBe(true));
  it("UZ-проживание без region → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, region: undefined }).success).toBe(false));
  it("UZ-проживание с region вне UZ_REGIONS → ошибка", () =>
    expect(basicSchema.safeParse({ ...ok, region: "Москва" }).success).toBe(false));
  it("не-UZ проживание без region → ок (опционально)", () =>
    expect(
      basicSchema.safeParse({ ...ok, country_of_residence: "RU", region: undefined }).success,
    ).toBe(true));
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
  // V2 ext 2026-06-28: убран religion_importance 1-5, добавлен religion_practice
  // (required) + religion_partner_match (optional).
  const base = {
    religion: "islam",
    religion_practice: "striving",
    education: "higher",
    values: ["family"],
  };
  it("1-3 ценности ок", () => expect(valuesSchema.safeParse(base).success).toBe(true));
  it("с religion_partner_match ок", () =>
    expect(
      valuesSchema.safeParse({
        ...base,
        religion_partner_match: "same_religion_same_practice",
      }).success,
    ).toBe(true));
  it("4 ценности → ошибка", () =>
    expect(
      valuesSchema.safeParse({ ...base, values: ["family", "faith", "health", "growth"] }).success,
    ).toBe(false));
  it("0 ценностей → ошибка", () =>
    expect(valuesSchema.safeParse({ ...base, values: [] }).success).toBe(false));
  it("religion_practice вне enum → ошибка", () =>
    expect(valuesSchema.safeParse({ ...base, religion_practice: "very_observant" }).success).toBe(false));
  it("religion_practice отсутствует → ошибка", () =>
    expect(valuesSchema.safeParse({ ...base, religion_practice: undefined }).success).toBe(false));
});

describe("lookingForSchema", () => {
  const base = { partner_age_min: 22, partner_age_max: 30, geo_preference: "my_city" };
  it("корректный диапазон ок", () => expect(lookingForSchema.safeParse(base).success).toBe(true));
  it("min>max → ошибка", () =>
    expect(lookingForSchema.safeParse({ ...base, partner_age_min: 35 }).success).toBe(false));
  it("<18 → ошибка", () =>
    expect(lookingForSchema.safeParse({ ...base, partner_age_min: 16 }).success).toBe(false));
});
