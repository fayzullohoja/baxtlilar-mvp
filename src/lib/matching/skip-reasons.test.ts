import { describe, it, expect } from "vitest";
import {
  SKIP_REASONS,
  SELECTABLE_SKIP_REASONS,
  FILTER_REASONS,
  hiddenUntil,
  isSkipReason,
  suggestsFilterFix,
  type SkipReason,
} from "./skip-reasons";

const NOW = Date.UTC(2026, 7, 25, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe("причины отказа и срок возврата", () => {
  it("у каждой причины есть решение про срок", () => {
    // Забытая причина вернула бы undefined и молча превратилась в «сейчас же
    // покажем снова» либо в вечное сокрытие - в зависимости от того, как это
    // ляжет в SQL. Поэтому проверяем весь список целиком.
    for (const r of SKIP_REASONS) {
      const v = hiddenUntil(r, NOW);
      expect(v === null || v instanceof Date).toBe(true);
    }
  });

  it("жалобы на фильтр прячут навсегда - их снимает правка рамок, а не время", () => {
    expect(hiddenUntil("age", NOW)).toBeNull();
    expect(hiddenUntil("geo", NOW)).toBeNull();
  });

  it("«сейчас не готов» и молчание - месяц", () => {
    expect(hiddenUntil("not_ready", NOW)!.getTime()).toBe(NOW + 30 * DAY);
    expect(hiddenUntil("dismissed", NOW)!.getTime()).toBe(NOW + 30 * DAY);
  });

  it("«просто не моё» - три месяца, дольше чем «не готов»", () => {
    const notMine = hiddenUntil("not_my_type", NOW)!.getTime();
    expect(notMine).toBe(NOW + 90 * DAY);
    expect(notMine).toBeGreaterThan(hiddenUntil("not_ready", NOW)!.getTime());
  });

  it("жалоба на анкету и «больше не показывать» - навсегда", () => {
    // Возвращать того, на кого пожаловались, нельзя: с анкетой разбирается
    // оператор, а не лента. «Больше не показывать» - прямая просьба человека.
    expect(hiddenUntil("profile_issue", NOW)).toBeNull();
    expect(hiddenUntil("never", NOW)).toBeNull();
  });

  it("«больше не показывать» не предлагается при первом показе", () => {
    // Подталкивать к необратимому решению того, кого видишь впервые, не надо.
    expect(SELECTABLE_SKIP_REASONS).not.toContain("never");
    // dismissed ставит сервер, когда шторку закрыли молча - в списке его быть
    // не должно, иначе человек выберет «я ничего не выбрал».
    expect(SELECTABLE_SKIP_REASONS).not.toContain("dismissed");
  });

  it("всё, что можно выбрать, - настоящая причина", () => {
    for (const r of SELECTABLE_SKIP_REASONS) expect(SKIP_REASONS).toContain(r);
  });

  it("предложение поправить фильтр показывается ровно на двух причинах", () => {
    const suggesting = SKIP_REASONS.filter((r) => suggestsFilterFix(r));
    expect(suggesting).toEqual([...FILTER_REASONS]);
  });

  it("чужое значение причиной не считается", () => {
    expect(isSkipReason("age")).toBe(true);
    expect(isSkipReason("boring")).toBe(false);
    expect(isSkipReason("")).toBe(false);
    expect(isSkipReason(null)).toBe(false);
    expect(isSkipReason(42)).toBe(false);
    // Проверка нужна именно на границе: значение приходит из тела запроса и
    // уходит в колонку с CHECK-ограничением. Незнакомая строка обязана
    // отбиваться в роуте, а не падать ошибкой базы на живом человеке.
    expect(isSkipReason("AGE")).toBe(false);
  });

  it("время передаётся снаружи - функция не зависит от часов машины", () => {
    const a = hiddenUntil("not_ready", 0)!.getTime();
    const b = hiddenUntil("not_ready", 1_000)!.getTime();
    expect(b - a).toBe(1_000);
  });

  it("список причин не содержит дублей", () => {
    expect(new Set<SkipReason>(SKIP_REASONS).size).toBe(SKIP_REASONS.length);
  });
});
