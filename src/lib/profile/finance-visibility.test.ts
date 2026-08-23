import { describe, it, expect } from "vitest";
import {
  shouldAskIncomeRange,
  incomeHidingValuesAreKnown,
} from "./finance-visibility";

describe("finance-visibility (family launch, замечание 3)", () => {
  it("не спрашивает размер дохода у тех, у кого дохода нет", () => {
    expect(shouldAskIncomeRange("none")).toBe(false);
  });

  it("не спрашивает размер дохода у тех, кто отказался отвечать", () => {
    expect(shouldAskIncomeRange("prefer_not")).toBe(false);
  });

  it("спрашивает у остальных", () => {
    expect(shouldAskIncomeRange("stable")).toBe(true);
    expect(shouldAskIncomeRange("high")).toBe(true);
    expect(shouldAskIncomeRange("unstable")).toBe(true);
  });

  it("пока ничего не выбрано - вопрос виден", () => {
    expect(shouldAskIncomeRange("")).toBe(true);
    expect(shouldAskIncomeRange(null)).toBe(true);
    expect(shouldAskIncomeRange(undefined)).toBe(true);
  });

  it("скрывающие значения существуют в options.ts (страж от переименования)", () => {
    expect(incomeHidingValuesAreKnown()).toBe(true);
  });
});
