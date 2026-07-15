import type { OnboardingStep } from "@/lib/state-machine/types";

/**
 * Фаза 6 (§3) — прогресс-бар анкеты в стиле Duolingo.
 *
 * Порядок ШАГОВ-ФОРМ анкеты (линейный, пост-Фаза-4: preview вынесен в конец после
 * quiz/attribution и в счётчик НЕ входит — это финальный обзор, а не форма). Все
 * перечисленные шаги проходит КАЖДЫЙ юзер (условны только поля ВНУТРИ форм, не
 * сами шаги), поэтому знаменатель не «врёт». Держать в синхроне с ALLOWED_TRANSITIONS
 * — есть drift-guard тест (anketa-progress.test.ts), как у CLIENT_ONBOARDING_PATHS.
 */
export const ANKETA_STEP_ORDER: readonly OnboardingStep[] = [
  "profile_basic",
  "profile_appearance",
  "profile_birth_place",
  "profile_self",
  "profile_family",
  "profile_parents",
  "profile_values",
  "profile_family_model",
  "profile_finance",
  "profile_lifestyle",
  "profile_health",
  "profile_marriage",
  "profile_partner_extended",
  "profile_photos",
];

export type AnketaProgress = {
  /** 1-based номер текущего шага */
  current: number;
  /** всего шагов-форм анкеты */
  total: number;
  /** 0..100 — доля заполнения (текущий шаг считается начатым) */
  percent: number;
};

/** Прогресс для шага анкеты. null — если шаг не входит в счётчик (bot/verify/quiz/
 *  preview/tutorial): у таких страниц прогресс-бар не показываем. */
export function anketaProgress(step: OnboardingStep): AnketaProgress | null {
  const idx = ANKETA_STEP_ORDER.indexOf(step);
  if (idx === -1) return null;
  const total = ANKETA_STEP_ORDER.length;
  const current = idx + 1;
  return { current, total, percent: Math.round((current / total) * 100) };
}
