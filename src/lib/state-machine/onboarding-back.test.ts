import { describe, it, expect } from "vitest";
import { ONBOARDING_BACK, ONBOARDING_PATHS } from "./router";
import type { OnboardingStep } from "./types";

describe("ONBOARDING_BACK — кнопка «Назад»", () => {
  it("у каждого back-шага есть валидный путь в ONBOARDING_PATHS", () => {
    for (const [from, to] of Object.entries(ONBOARDING_BACK)) {
      expect(ONBOARDING_PATHS[to as OnboardingStep], `нет пути для ${to}`).toBeTruthy();
      expect(ONBOARDING_PATHS[from as OnboardingStep], `нет пути для ${from}`).toBeTruthy();
    }
  });

  it("basic — первый шаг, back нет", () => {
    expect(ONBOARDING_BACK.profile_basic).toBeUndefined();
  });

  it("каждый back ведёт строго к предыдущему шагу V4-цепочки (нет циклов)", () => {
    // Идём назад из tutorial_safety до тех пор, пока back есть — должны дойти до
    // basic (шаг без back) за конечное число шагов, без зацикливания.
    const seen = new Set<string>();
    let step: OnboardingStep | undefined = "tutorial_safety";
    let guard = 0;
    while (step && ONBOARDING_BACK[step] && guard < 100) {
      expect(seen.has(step), `цикл на ${step}`).toBe(false);
      seen.add(step);
      step = ONBOARDING_BACK[step];
      guard++;
    }
    expect(step).toBe("profile_basic");
  });

  it("покрывает весь V4-поток анкеты (appearance…preview) + quiz/attribution/tutorial", () => {
    const mustHaveBack: OnboardingStep[] = [
      "profile_appearance",
      "profile_birth_place",
      "profile_self",
      "profile_family",
      "profile_values",
      "profile_family_model",
      "profile_finance",
      "profile_lifestyle",
      "profile_marriage",
      "profile_partner_extended",
      "profile_privacy",
      "profile_photos",
      "profile_preview",
      "quiz",
      "attribution",
      "tutorial_intro",
      "tutorial_swipe",
      "tutorial_chat",
      "tutorial_safety",
    ];
    for (const s of mustHaveBack) {
      expect(ONBOARDING_BACK[s], `нет back для ${s}`).toBeTruthy();
    }
  });
});
