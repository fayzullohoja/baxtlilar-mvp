import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, verifyPasswordConstantTime } from "@/lib/admin/password";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe("время ответа не выдаёт существование учётки", () => {
  it("проверка с заглушкой стоит столько же, сколько настоящая", () => {
    const real = hashPassword("настоящий-пароль");
    const N = 12;
    const existing: number[] = [];
    const missing: number[] = [];
    for (let i = 0; i < N; i++) {
      let t = performance.now();
      verifyPasswordConstantTime("попытка", real);
      existing.push(performance.now() - t);
      t = performance.now();
      verifyPasswordConstantTime("попытка", null);
      missing.push(performance.now() - t);
    }
    const a = median(existing);
    const b = median(missing);
    // Разница медиан не должна превышать половину меньшего из времён -
    // раньше «нет учётки» отвечало практически мгновенно.
    expect(Math.abs(a - b), `существующий ${a.toFixed(1)}мс, отсутствующий ${b.toFixed(1)}мс`)
      .toBeLessThan(Math.min(a, b) * 0.5);
  });

  it("СТАРОЕ поведение действительно было оракулом (контроль)", () => {
    const real = hashPassword("настоящий-пароль");
    let t = performance.now();
    for (let i = 0; i < 8; i++) verifyPassword("попытка", real);
    const withHash = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < 8; i++) { /* учётки нет -> скалькулировать нечего */ }
    const withoutHash = performance.now() - t;
    expect(withHash).toBeGreaterThan(withoutHash * 5);
  });
});
