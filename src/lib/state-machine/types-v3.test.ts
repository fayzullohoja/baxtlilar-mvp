import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS } from "./types";

// V4 (2026-06-30, Чат 2 — Анкета.md) — учредительские поправки:
//   • swap appearance <-> birth_place (№4)
//   • новые шаги finance (Экран 9) и lifestyle (Экран 10) между family_model
//     и marriage.
describe("V4 anketa transitions", () => {
  it("profile_basic → profile_appearance (V4: appearance первый после basic)", () => {
    expect(ALLOWED_TRANSITIONS.profile_basic).toContain("profile_appearance");
  });

  it("profile_appearance → profile_birth_place (swap)", () => {
    expect(ALLOWED_TRANSITIONS.profile_appearance).toContain("profile_birth_place");
  });

  it("profile_birth_place → profile_self", () => {
    expect(ALLOWED_TRANSITIONS.profile_birth_place).toContain("profile_self");
  });

  it("profile_self → profile_family", () => {
    expect(ALLOWED_TRANSITIONS.profile_self).toContain("profile_family");
  });

  // Экран 6 «Родители» вставлен между family и values (2026-07-12).
  it("profile_family → profile_parents (NEW Экран 6)", () => {
    expect(ALLOWED_TRANSITIONS.profile_family).toContain("profile_parents");
    expect(ALLOWED_TRANSITIONS.profile_family).not.toContain("profile_values");
  });

  it("profile_parents → profile_values", () => {
    expect(ALLOWED_TRANSITIONS.profile_parents).toContain("profile_values");
  });

  it("profile_values → profile_family_model", () => {
    expect(ALLOWED_TRANSITIONS.profile_values).toContain("profile_family_model");
  });

  it("profile_family_model → profile_finance (NEW V4)", () => {
    expect(ALLOWED_TRANSITIONS.profile_family_model).toContain("profile_finance");
  });

  it("profile_finance → profile_lifestyle (NEW V4)", () => {
    expect(ALLOWED_TRANSITIONS.profile_finance).toContain("profile_lifestyle");
  });

  it("profile_lifestyle → profile_health (§11 вставлен 2026-07-14)", () => {
    expect(ALLOWED_TRANSITIONS.profile_lifestyle).toContain("profile_health");
  });

  it("profile_health → profile_marriage (§11)", () => {
    expect(ALLOWED_TRANSITIONS.profile_health).toContain("profile_marriage");
  });

  it("profile_marriage → profile_partner_extended", () => {
    expect(ALLOWED_TRANSITIONS.profile_marriage).toContain("profile_partner_extended");
  });

  it("profile_partner_extended → profile_photos (экран privacy пропущен)", () => {
    expect(ALLOWED_TRANSITIONS.profile_partner_extended).toContain("profile_photos");
    // 2026-07-12: privacy убран из forward-потока — партнёр ведёт сразу на фото
    expect(ALLOWED_TRANSITIONS.profile_partner_extended).not.toContain("profile_privacy");
  });

  // legacy pass-through: юзер, застрявший на profile_privacy, всё ещё уходит на photos
  it("profile_privacy → profile_photos (legacy)", () => {
    expect(ALLOWED_TRANSITIONS.profile_privacy).toContain("profile_photos");
  });

  it("forbid profile_basic → profile_self напрямую", () => {
    expect(ALLOWED_TRANSITIONS.profile_basic).not.toContain("profile_self");
  });
});
