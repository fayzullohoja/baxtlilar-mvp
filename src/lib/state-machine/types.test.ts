import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, ALL_STEPS } from "./types";

/** Множество шагов, достижимых из start по ALLOWED_TRANSITIONS (BFS). */
function reachableFrom(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift() as keyof typeof ALLOWED_TRANSITIONS;
    for (const next of ALLOWED_TRANSITIONS[s] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("ALLOWED_TRANSITIONS", () => {
  it("покрывает все шаги как источник", () => {
    for (const step of ALL_STEPS) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(step);
    }
  });

  it("все целевые шаги — валидные", () => {
    for (const [, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const t of targets) expect(ALL_STEPS).toContain(t);
    }
  });

  it("нет self-loops", () => {
    for (const [src, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(src as (typeof ALL_STEPS)[number]);
    }
  });

  it("MVP-порядок: телефон перед документами", () => {
    expect(ALLOWED_TRANSITIONS.consent).toContain("phone_input");
    expect(ALLOWED_TRANSITIONS.otp_pending).toContain("doc_upload");
    expect(ALLOWED_TRANSITIONS.doc_upload).toContain("selfie_upload");
    expect(ALLOWED_TRANSITIONS.selfie_upload).toContain("moderation_pending");
  });

  it("модератор может одобрить или вернуть с moderation_pending", () => {
    expect(ALLOWED_TRANSITIONS.moderation_pending).toEqual(
      expect.arrayContaining(["profile_basic", "needs_changes", "verification_rejected"]),
    );
  });

  it("active — терминальный (для onboarding-цикла)", () => {
    expect(ALLOWED_TRANSITIONS.active).toEqual([]);
  });
});

describe("ALLOWED_TRANSITIONS connectivity (анти-застревание)", () => {
  it("нет тупиков в середине потока — терминален только active", () => {
    const deadEnds = ALL_STEPS.filter((s) => s !== "active" && ALLOWED_TRANSITIONS[s].length === 0);
    expect(deadEnds).toEqual([]);
  });

  it("каждый шаг достижим из language (нет шагов-сирот)", () => {
    const reached = reachableFrom("language");
    const unreachable = ALL_STEPS.filter((s) => !reached.has(s));
    expect(unreachable).toEqual([]);
  });

  it("active достижим из language (happy-path замыкается)", () => {
    expect(reachableFrom("language").has("active")).toBe(true);
  });
});
