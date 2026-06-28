import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS } from "./types";

describe("V3 anketa transitions (Sprint 1)", () => {
  it("profile_basic ведёт в profile_birth_place (новый Sprint 1 переход)", () => {
    expect(ALLOWED_TRANSITIONS.profile_basic).toContain("profile_birth_place");
  });

  it("profile_birth_place → profile_self (заглушка Sprint 2)", () => {
    expect(ALLOWED_TRANSITIONS.profile_birth_place).toContain("profile_self");
  });

  it("profile_birth_place → profile_appearance (legacy fallback)", () => {
    expect(ALLOWED_TRANSITIONS.profile_birth_place).toContain("profile_appearance");
  });

  it("profile_self → profile_family (Sprint 2 переход)", () => {
    expect(ALLOWED_TRANSITIONS.profile_self).toContain("profile_family");
  });

  it("profile_values → profile_family_model (Sprint 2)", () => {
    expect(ALLOWED_TRANSITIONS.profile_values).toContain("profile_family_model");
  });

  it("profile_family_model → profile_marriage", () => {
    expect(ALLOWED_TRANSITIONS.profile_family_model).toContain("profile_marriage");
  });

  it("profile_marriage → profile_partner_extended", () => {
    expect(ALLOWED_TRANSITIONS.profile_marriage).toContain("profile_partner_extended");
  });

  it("profile_partner_extended → profile_looking_for", () => {
    expect(ALLOWED_TRANSITIONS.profile_partner_extended).toContain(
      "profile_looking_for",
    );
  });

  it("forbid profile_basic → profile_self напрямую (должен пройти через birth_place)", () => {
    expect(ALLOWED_TRANSITIONS.profile_basic).not.toContain("profile_self");
  });

  it("forbid profile_birth_place → profile_family напрямую", () => {
    expect(ALLOWED_TRANSITIONS.profile_birth_place).not.toContain("profile_family");
  });
});
