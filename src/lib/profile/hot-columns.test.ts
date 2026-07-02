import { test, expect } from "vitest";
import { splitHotCold } from "./schemas";

// OB-1 регрессия: basic-роут пишет splitHotCold(...).hot в колонки, а cold — в
// extended jsonb. Identity-поля basic (display_name/gender/birth_date/
// citizenship/country_of_residence/region) — РЕАЛЬНЫЕ колонки user_profiles.
// Если они не в HOT_COLUMNS, splitHotCold зачисляет их в cold → они уходят в
// extended, а колонки остаются NULL → publish (проверяет gender/birth_date/
// display_name) навсегда отдаёт profile_incomplete, gender-wording ломается.

test("basic identity-поля попадают в колонки (hot), а не в extended (cold)", () => {
  const { hot, cold } = splitHotCold({
    display_name: "Ali",
    gender: "m",
    birth_date: "2000-01-01",
    citizenship: "UZ",
    country_of_residence: "UZ",
    region: "toshkent",
    district: "Юнусабадский",
    district_visible_public: false,
  });

  for (const k of [
    "display_name",
    "gender",
    "birth_date",
    "citizenship",
    "country_of_residence",
    "region",
  ]) {
    expect(hot, `${k} должно писаться в колонку (hot)`).toHaveProperty(k);
    expect(cold, `${k} НЕ должно уходить в extended (cold)`).not.toHaveProperty(k);
  }

  // Для basic cold обязан быть пуст — все его поля являются колонками.
  expect(Object.keys(cold)).toHaveLength(0);
});
