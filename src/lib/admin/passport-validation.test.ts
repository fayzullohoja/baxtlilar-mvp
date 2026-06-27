import { describe, it, expect } from "vitest";
import {
  validatePassportPayload,
  validatePinflChecksum,
  pinflGenderDigit,
  type PassportPayload,
} from "./passport-validation";

// Test fixtures computed manually against UZ PINFL algorithm
// (weights 7-3-1 repeating, mod 11, first digit must be 3-6 for century).
// PINFL_VALID_M: digits 3120497012345 → checksum 5 → "31204970123455", 7th digit=7 (odd → M)
// PINFL_VALID_F: digits 3120490022345 → checksum 1 → "31204900223451", 7th digit=0 (even → F)
const PINFL_VALID_M = "31204970123455";
const PINFL_VALID_F = "31204900223451";

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
  pinfl: PINFL_VALID_M,
  issued_by: "ОВД Юнусабадского района",
  issued_at: "2018-06-15",
  expires_at: "2099-06-15",
  region_code: "UZ-TAS",
  district_code: "UZ-TAS-YN",
  locality: "Ташкент",
  street_address: "Бунёдкор 18, кв 42",
};

describe("validatePinflChecksum", () => {
  it("validates a checksum-correct PINFL", () => {
    expect(validatePinflChecksum(PINFL_VALID_M)).toBe(true);
    expect(validatePinflChecksum(PINFL_VALID_F)).toBe(true);
  });
  it("rejects all-zeros (invalid century digit)", () => {
    expect(validatePinflChecksum("00000000000000")).toBe(false);
  });
  it("rejects non-14-digit input", () => {
    expect(validatePinflChecksum("12345")).toBe(false);
  });
  it("rejects mismatched checksum", () => {
    // Last digit altered
    expect(validatePinflChecksum("31204970123459")).toBe(false);
  });
  it("rejects non-digit characters", () => {
    expect(validatePinflChecksum("3120497012345a")).toBe(false);
  });
});

describe("pinflGenderDigit", () => {
  it("returns M for odd 7th digit", () => {
    expect(pinflGenderDigit(PINFL_VALID_M)).toBe("M");
  });
  it("returns F for even 7th digit", () => {
    expect(pinflGenderDigit(PINFL_VALID_F)).toBe("F");
  });
  it("returns null for invalid input", () => {
    expect(pinflGenderDigit("123")).toBe(null);
  });
});

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

  it("blocks pinfl with bad checksum", () => {
    const errors = validatePassportPayload({ ...valid, pinfl: "31204970123459" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "pinfl", severity: "block" }),
    );
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

  it("warns when pinfl gender digit mismatches selected gender", () => {
    // PINFL_VALID_F encodes F (7th digit=0 even); selecting M should warn
    const errors = validatePassportPayload({ ...valid, pinfl: PINFL_VALID_F, gender: "M" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "gender", severity: "warn" }),
    );
  });

  it("blocks missing required text fields", () => {
    const errors = validatePassportPayload({ ...valid, street_address: "" });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "street_address", severity: "block" }),
    );
  });
});
