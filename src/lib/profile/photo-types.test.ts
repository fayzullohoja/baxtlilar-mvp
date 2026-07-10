import { describe, it, expect } from "vitest";
import { PHOTO_TYPE, PHOTO_TYPES_PRE_MUTUAL, vals } from "./options";

// =============================================================================
// Экран 13 — типы фото (privacy-инвариант)
// =============================================================================
// Гарантия приватности реализована в БД (get_recommendations + CHECK,
// миграция 20260711020000) и в read-путях (mini.ts / publish / photos-done).
// Здесь фиксируем клиентские инварианты, на которые опираются форма и роуты.

describe("PHOTO_TYPE (Экран 13)", () => {
  it("содержит ровно portrait/full_body/family в этом порядке (= порядок слотов)", () => {
    expect(vals(PHOTO_TYPE)).toEqual(["portrait", "full_body", "family"]);
  });

  it("family НЕ входит в pre-mutual типы (только post-mutual)", () => {
    expect(PHOTO_TYPES_PRE_MUTUAL).not.toContain("family");
  });

  it("portrait входит в pre-mutual типы (главное фото ленты)", () => {
    expect(PHOTO_TYPES_PRE_MUTUAL).toContain("portrait");
  });

  it("каждый тип имеет ru+uz лейбл", () => {
    for (const o of PHOTO_TYPE) {
      expect(o.ru.length).toBeGreaterThan(0);
      expect(o.uz.length).toBeGreaterThan(0);
    }
  });
});
