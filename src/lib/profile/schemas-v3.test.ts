import { describe, it, expect } from "vitest";
import {
  birthPlaceSchema,
  validateExtended,
  splitHotCold,
  HOT_COLUMNS,
  EXTENDED_SCHEMA_VERSION,
} from "./schemas";

describe("V3 birthPlaceSchema", () => {
  const ok = {
    birth_country: "UZ",
    birth_region: "samarkand",
    birth_district: "Pastdargom",
    birth_city: "Samarqand",
  };

  it("принимает полный payload UZ", () => {
    expect(birthPlaceSchema.safeParse(ok).success).toBe(true);
  });

  it("отклоняет неканонический birth_region для UZ (не из UZ_REGIONS)", () => {
    // Регресс: смена страны обратно на UZ раньше оставляла freeform-строку
    // (напр. «Almaty») в birth_region — сервер обязан отклонять.
    expect(
      birthPlaceSchema.safeParse({ ...ok, birth_region: "Almaty" }).success,
    ).toBe(false);
  });

  it("принимает только birth_country (region/district/city опц.)", () => {
    expect(
      birthPlaceSchema.safeParse({ birth_country: "TR" }).success,
    ).toBe(true);
  });

  it("отклоняет пустой birth_country", () => {
    expect(
      birthPlaceSchema.safeParse({ ...ok, birth_country: "" }).success,
    ).toBe(false);
  });

  it("отклоняет однобуквенный birth_country", () => {
    expect(
      birthPlaceSchema.safeParse({ ...ok, birth_country: "X" }).success,
    ).toBe(false);
  });

  it("отклоняет birth_city > 128 символов", () => {
    expect(
      birthPlaceSchema.safeParse({ ...ok, birth_city: "x".repeat(129) }).success,
    ).toBe(false);
  });
});

describe("V3 validateExtended", () => {
  it("принимает пустой объект {}", () => {
    expect(() => validateExtended({})).not.toThrow();
  });

  it("принимает корректный family.decision_model", () => {
    expect(() =>
      validateExtended({
        _meta: { schema_version: EXTENDED_SCHEMA_VERSION },
        family: { decision_model: "joint" },
      }),
    ).not.toThrow();
  });

  it("отклоняет invalid family.decision_model", () => {
    expect(() =>
      validateExtended({ family: { decision_model: "tyrant" } }),
    ).toThrow();
  });

  it("отклоняет family.views длиной > 5", () => {
    expect(() =>
      validateExtended({ family: { views: ["a", "b", "c", "d", "e", "f"] } }),
    ).toThrow();
  });

  it("отклоняет children.age_ranges с отрицательным числом", () => {
    expect(() =>
      validateExtended({ children: { age_ranges: [3, -1] } }),
    ).toThrow();
  });

  it("отклоняет children.age_ranges > 50", () => {
    expect(() =>
      validateExtended({ children: { age_ranges: [3, 51] } }),
    ).toThrow();
  });

  it("принимает partner.location_preference корректного scope", () => {
    expect(() =>
      validateExtended({
        partner: {
          location_preference: {
            scope: "same_city",
            cities: ["Tashkent"],
          },
        },
      }),
    ).not.toThrow();
  });

  it("отклоняет partner.location_preference невалидного scope", () => {
    expect(() =>
      validateExtended({
        partner: { location_preference: { scope: "galaxy" } },
      }),
    ).toThrow();
  });

  it("отклоняет unknown top-level ключи (strict)", () => {
    expect(() =>
      validateExtended({ rogue_field: "x" }),
    ).toThrow();
  });

  it("round-trip JSON → validate → equal", () => {
    // V4 (2026-06-30): `by_domain` удалён из FAMILY_DECISION_MODEL (учредитель).
    // Используем `joint` — валидное значение оставшегося enum.
    const sample = {
      _meta: { schema_version: 1 },
      family: { decision_model: "joint" as const, views: ["v1", "v2"] },
      living: { future_format: "with_husband_family" },
      partner: {
        location_preference: { scope: "any" as const },
      },
    };
    const out = validateExtended(JSON.parse(JSON.stringify(sample)));
    expect(out).toEqual(sample);
  });
});

describe("V3 splitHotCold", () => {
  it("birth_country → hot", () => {
    const { hot, cold } = splitHotCold({ birth_country: "UZ" });
    expect(hot).toEqual({ birth_country: "UZ" });
    expect(cold).toEqual({});
  });

  it("family.views → cold", () => {
    const { hot, cold } = splitHotCold({
      family: { views: ["v1"] },
    });
    expect(hot).toEqual({});
    expect(cold).toEqual({ family: { views: ["v1"] } });
  });

  it("смесь hot и cold разделяется правильно", () => {
    const { hot, cold } = splitHotCold({
      birth_country: "UZ",
      activity_field: "it_software",
      family: { decision_model: "joint" },
      bio: { hobbies: "reading" },
    });
    expect(hot).toEqual({
      birth_country: "UZ",
      activity_field: "it_software",
    });
    expect(cold).toEqual({
      family: { decision_model: "joint" },
      bio: { hobbies: "reading" },
    });
  });

  it("все 16 HOT_COLUMNS попадают в hot", () => {
    const payload = Object.fromEntries(
      [...HOT_COLUMNS].map((k) => [k, "x"]),
    );
    const { hot, cold } = splitHotCold(payload);
    expect(Object.keys(hot).sort()).toEqual([...HOT_COLUMNS].sort());
    expect(cold).toEqual({});
  });
});
