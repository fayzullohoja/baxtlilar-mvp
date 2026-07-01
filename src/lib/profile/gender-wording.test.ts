import { describe, it, expect } from "vitest";
import { getGenderedOptionLabel, getGenderedQuestion } from "./gender-wording";

describe("getGenderedOptionLabel — HOUSEHOLD_RESPONSIBILITY_MODEL.mostly_partner", () => {
  it("M-юзер + ru → «В основном жена»", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "mostly_partner", "m", "ru"),
    ).toBe("В основном жена");
  });

  it("F-юзер + ru → «В основном муж»", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "mostly_partner", "f", "ru"),
    ).toBe("В основном муж");
  });

  it("M-юзер + uz → «Asosan xotin»", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "mostly_partner", "m", "uz"),
    ).toBe("Asosan xotin");
  });

  it("F-юзер + uz → «Asosan er»", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "mostly_partner", "f", "uz"),
    ).toBe("Asosan er");
  });

  it("gender=null → нейтральный лейбл из options.ts", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "mostly_partner", null, "ru"),
    ).toBe("В основном партнёр");
  });

  it("gender=undefined → нейтральный лейбл", () => {
    expect(
      getGenderedOptionLabel(
        "HOUSEHOLD_RESPONSIBILITY_MODEL",
        "mostly_partner",
        undefined,
        "uz",
      ),
    ).toBe("Asosan hamroh");
  });
});

describe("getGenderedOptionLabel — fallback behaviour", () => {
  it("опция без gender-override → нейтральный лейбл (traditional)", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "traditional", "m", "ru"),
    ).toBe("Традиционно (жена — дом, муж — обеспечение)");
  });

  it("незарегистрированная константа → возвращаем value", () => {
    expect(
      getGenderedOptionLabel("NOT_A_REAL_CONST", "whatever", "m", "ru"),
    ).toBe("whatever");
  });

  it("неизвестный value внутри известной константы → labelOf вернёт value", () => {
    expect(
      getGenderedOptionLabel("HOUSEHOLD_RESPONSIBILITY_MODEL", "__ghost__", "f", "ru"),
    ).toBe("__ghost__");
  });
});

describe("getGenderedQuestion — extension point (MVP)", () => {
  it("неизвестный ключ → пустая строка (caller фолбэчит на i18n)", () => {
    expect(getGenderedQuestion("partnerWorkLabel", "m", "ru")).toBe("");
    expect(getGenderedQuestion("partnerWorkLabel", null, "uz")).toBe("");
  });
});
