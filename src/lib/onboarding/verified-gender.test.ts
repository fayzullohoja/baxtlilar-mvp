import { describe, it, expect } from "vitest";
import { verifiedGenderMatches } from "./verified-gender";

// C6 — при публикации анкетный пол (user_profiles.gender, 'm'/'f') должен
// совпадать с верифицированным паспортным (user_identity.gender, 'M'/'F').
// Иначе верифицированный юзер мог бы выйти в матчинг под противоположным полом
// (обход взаимного пола / catfishing в marriage-приложении).

describe("verifiedGenderMatches", () => {
  it("совпадение с точностью до регистра → true", () => {
    expect(verifiedGenderMatches("m", "M")).toBe(true);
    expect(verifiedGenderMatches("f", "F")).toBe(true);
    expect(verifiedGenderMatches("M", "m")).toBe(true);
  });

  it("несовпадение пола → false (блок публикации)", () => {
    expect(verifiedGenderMatches("m", "F")).toBe(false);
    expect(verifiedGenderMatches("f", "M")).toBe(false);
  });

  it("нет верифицированного пола (null/undefined/пусто) → true, не локаутим", () => {
    expect(verifiedGenderMatches("m", null)).toBe(true);
    expect(verifiedGenderMatches("m", undefined)).toBe(true);
    expect(verifiedGenderMatches("f", "")).toBe(true);
    expect(verifiedGenderMatches("f", "   ")).toBe(true);
  });

  it("верифицированный пол есть, анкетный пропал → false (не можем подтвердить)", () => {
    expect(verifiedGenderMatches(null, "M")).toBe(false);
    expect(verifiedGenderMatches(undefined, "F")).toBe(false);
    expect(verifiedGenderMatches("", "M")).toBe(false);
  });
});
