import { describe, it, expect } from "vitest";
import { ANKETA_STEP_ORDER, anketaProgress } from "./anketa-progress";
import { ALLOWED_TRANSITIONS } from "@/lib/state-machine/types";
import { ONBOARDING_PATHS, ONBOARDING_BACK } from "@/lib/state-machine/router";

describe("anketa-progress (Фаза 6 §3)", () => {
  // Drift-guard: порядок прогресса обязан совпадать с реальным forward-графом
  // онбординга — иначе «Шаг N из M» врёт при следующем изменении потока.
  it("каждый шаг ведёт к следующему в ALLOWED_TRANSITIONS", () => {
    for (let i = 0; i < ANKETA_STEP_ORDER.length - 1; i++) {
      const from = ANKETA_STEP_ORDER[i];
      const to = ANKETA_STEP_ORDER[i + 1];
      expect(ALLOWED_TRANSITIONS[from], `${from} → ${to}`).toContain(to);
    }
  });

  // Жёстче membership-проверки: канонический back каждого следующего шага обязан
  // указывать на предыдущий. Ловит будущий forward-skip мимо finance/lifestyle/
  // health (legacy-edge family_model→marriage прошёл бы .toContain, но back[marriage]
  // остался бы health → рассинхрон бы всплыл здесь). Adversarial-review Ф5+6.
  it("канонический ONBOARDING_BACK совпадает с порядком (нет skip-переписывания)", () => {
    for (let i = 0; i < ANKETA_STEP_ORDER.length - 1; i++) {
      const prev = ANKETA_STEP_ORDER[i];
      const next = ANKETA_STEP_ORDER[i + 1];
      expect(ONBOARDING_BACK[next], `back[${next}] должен быть ${prev}`).toBe(prev);
    }
  });

  it("у каждого шага есть путь в ONBOARDING_PATHS", () => {
    for (const s of ANKETA_STEP_ORDER) {
      expect(ONBOARDING_PATHS[s], `нет пути для ${s}`).toBeTruthy();
    }
  });

  it("последний шаг-форма ведёт на quiz (пост-Фаза-4: preview в конце)", () => {
    const last = ANKETA_STEP_ORDER[ANKETA_STEP_ORDER.length - 1];
    expect(last).toBe("profile_photos");
    expect(ALLOWED_TRANSITIONS[last]).toContain("quiz");
  });

  it("anketaProgress: 1-based номера, корректный percent", () => {
    expect(anketaProgress("profile_basic")).toEqual({ current: 1, total: 14, percent: 7 });
    expect(anketaProgress("profile_photos")).toEqual({ current: 14, total: 14, percent: 100 });
    expect(anketaProgress("profile_self")?.current).toBe(4);
  });

  it("не-анкетные шаги → null (bot/verify/quiz/preview/tutorial)", () => {
    expect(anketaProgress("quiz")).toBeNull();
    expect(anketaProgress("profile_preview")).toBeNull();
    expect(anketaProgress("attribution")).toBeNull();
    expect(anketaProgress("bot_language")).toBeNull();
  });
});
