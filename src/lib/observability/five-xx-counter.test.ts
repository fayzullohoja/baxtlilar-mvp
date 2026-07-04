import { describe, it, expect, beforeEach } from "vitest";
import { record5xx, count5xxLast5min, resetFiveXxForTests } from "./five-xx-counter";

// OBS-5 — in-memory скользящее 5-мин окно 5xx. Single-instance, теряется при
// рестарте (задокументировано). Питает /api/metrics.

beforeEach(() => resetFiveXxForTests());

describe("five-xx-counter", () => {
  it("считает записанные события в окне", () => {
    const t = 1_000_000;
    record5xx(t);
    record5xx(t + 1000);
    record5xx(t + 2000);
    expect(count5xxLast5min(t + 3000)).toBe(3);
  });

  it("события старше 5 минут выпадают из окна", () => {
    const t = 1_000_000;
    record5xx(t);
    record5xx(t + 60_000);
    // через 5 мин + чуть после первого события — первое выпало, второе ещё в окне
    expect(count5xxLast5min(t + 5 * 60_000 + 1)).toBe(1);
    // ещё позже — оба выпали
    expect(count5xxLast5min(t + 6 * 60_000 + 60_001)).toBe(0);
  });

  it("пустой счётчик → 0", () => {
    expect(count5xxLast5min(1_000_000)).toBe(0);
  });
});
