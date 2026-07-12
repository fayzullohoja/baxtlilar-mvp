import { describe, it, expect } from "vitest";
import {
  validatePassportPayload,
  type PassportPayload,
} from "./passport-validation";

// ПИНФЛ теперь валидируется ТОЛЬКО по формату (14 цифр) — контрольная цифра,
// правило «первая 3–6» и сверка пола убраны (решение оунера). Фикстуры — любые
// 14-значные строки, семантика цифр больше не важна.
const PINFL_14 = "31204970123455";

const valid: PassportPayload = {
  last_name: "Каримов",
  first_name: "Айбек",
  middle_name: "Эркинович",
  birth_date: "1997-04-02",
  gender: "M",
  citizenship: "UZ",
  birth_place: "Самарканд",
  passport_series: "AA",
  passport_number: "1234567",
  pinfl: PINFL_14,
  issued_by: "ОВД Юнусабадского района",
  issued_at: "2018-06-15",
  expires_at: "2099-06-15",
  region_code: "UZ-TAS",
  district_code: "UZ-TAS-YN",
  locality: "Ташкент",
  street_address: "Бунёдкор 18, кв 42",
};

describe("validatePassportPayload", () => {
  it("returns no blocking errors for valid payload", () => {
    const errors = validatePassportPayload(valid);
    const blockers = errors.filter((e) => e.severity === "block");
    expect(blockers).toEqual([]);
  });

  it("blocks empty last_name", () => {
    const errors = validatePassportPayload({ ...valid, last_name: "" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "last_name", severity: "block" }),
    );
  });

  it("blocks empty first_name", () => {
    const errors = validatePassportPayload({ ...valid, first_name: "" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "first_name", severity: "block" }),
    );
  });

  it("does not block on empty middle_name (optional)", () => {
    const errors = validatePassportPayload({ ...valid, middle_name: undefined });
    const middle = errors.find((e) => e.field === "middle_name");
    expect(middle).toBeUndefined();
  });

  it("blocks passport_series not matching ^[A-Z]{2}$", () => {
    const errors = validatePassportPayload({ ...valid, passport_series: "Aa" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "passport_series", severity: "block" }),
    );
  });

  it("blocks passport_number not 7 digits", () => {
    const errors = validatePassportPayload({ ...valid, passport_number: "12345" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "passport_number", severity: "block" }),
    );
  });

  it("blocks pinfl with wrong length", () => {
    const errors = validatePassportPayload({ ...valid, pinfl: "12345" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "pinfl", severity: "block" }),
    );
  });

  it("accepts any 14-digit PINFL — no checksum/first-digit/gender validation", () => {
    // Раньше эти давали warn; теперь — никакой pinfl/gender-ошибки вообще.
    for (const pinfl of ["31204970123459", "22222222222222", "99999999999999"]) {
      const errors = validatePassportPayload({ ...valid, pinfl });
      expect(errors.filter((e) => e.field === "pinfl")).toEqual([]);
      // и никаких производных gender-warn от ПИНФЛ
      expect(errors.filter((e) => e.field === "gender" && e.severity === "warn")).toEqual([]);
    }
  });

  it("blocks age < 18", () => {
    const today = new Date();
    const tooYoung = new Date(today.getUTCFullYear() - 17, today.getUTCMonth(), today.getUTCDate())
      .toISOString().slice(0, 10);
    const errors = validatePassportPayload({ ...valid, birth_date: tooYoung });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "birth_date", severity: "block" }),
    );
  });

  it("warns when expires_at is in the past", () => {
    const errors = validatePassportPayload({ ...valid, expires_at: "2020-01-01" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "expires_at", severity: "warn" }),
    );
  });

  it("blocks missing required text fields", () => {
    const errors = validatePassportPayload({ ...valid, street_address: "" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "street_address", severity: "block" }),
    );
  });
});
