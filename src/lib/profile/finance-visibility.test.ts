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

/**
 * Страж серверной очистки (находка аудита 23.08.2026).
 *
 * Клиентского скрытия недостаточно: роут /api/onboarding/profile/finance
 * собирает новый объект как `{...prevFinance, ...патч}`, поэтому уже сохранённый
 * monthly_income_range пережил бы смену ответа на «дохода нет». Здесь
 * воспроизведена ровно та сборка, что в роуте, - если кто-то уберёт delete,
 * тест упадёт.
 */
describe("серверная очистка размера дохода", () => {
  function mergeLikeRoute(
    prevFinance: Record<string, unknown>,
    incomeSource: string,
    incomingRange?: string,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {
      ...prevFinance,
      income_source_stability: incomeSource,
      ...(incomingRange ? { monthly_income_range: incomingRange } : {}),
    };
    if (!shouldAskIncomeRange(incomeSource)) delete next.monthly_income_range;
    return next;
  }

  it("стирает ранее сохранённый диапазон, когда человек сказал «дохода нет»", () => {
    const prev = { monthly_income_range: "10_20m", housing_status: "own" };
    const out = mergeLikeRoute(prev, "none");
    expect(out.monthly_income_range).toBeUndefined();
    // соседние поля не трогаем
    expect(out.housing_status).toBe("own");
  });

  it("стирает и при отказе отвечать", () => {
    const out = mergeLikeRoute({ monthly_income_range: "40m_plus" }, "prefer_not");
    expect(out.monthly_income_range).toBeUndefined();
  });

  it("не трогает диапазон у тех, кто доход указал", () => {
    const out = mergeLikeRoute({ monthly_income_range: "10_20m" }, "stable");
    expect(out.monthly_income_range).toBe("10_20m");
  });

  it("принимает новый диапазон, если человек его прислал", () => {
    const out = mergeLikeRoute({}, "high", "40m_plus");
    expect(out.monthly_income_range).toBe("40m_plus");
  });
});
