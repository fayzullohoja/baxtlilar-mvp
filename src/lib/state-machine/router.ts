import type { DbUser } from "@/lib/auth/current-user";
import type { OnboardingStep } from "./types";

/**
 * onboarding_step → путь экрана (без префикса локали).
 * Источник истины: Чат 12 §6 / Чат 13 §1.3 (порядок MVP).
 */
export const ONBOARDING_PATHS: Record<OnboardingStep, string> = {
  // bot-шаги — мини-аппа не должна показывать их UI; выкидываем на /open-in-telegram,
  // там user попадёт обратно в бот через deep-link.
  bot_language: "/open-in-telegram",
  bot_contact: "/open-in-telegram",
  bot_consent_pd: "/open-in-telegram",
  bot_consent_biometric: "/open-in-telegram",
  // Legacy SMS:
  language: "/open-in-telegram",
  consent: "/open-in-telegram",
  phone_input: "/open-in-telegram",
  otp_pending: "/open-in-telegram",
  // Mini-app:
  verification_intro: "/onboarding/verification-intro",
  doc_upload: "/onboarding/document",
  selfie_upload: "/onboarding/selfie",
  moderation_pending: "/onboarding/pending",
  needs_changes: "/onboarding/needs-changes",
  verification_rejected: "/onboarding/rejected",
  profile_basic: "/onboarding/profile/basic",
  profile_family: "/onboarding/profile/family",
  profile_values: "/onboarding/profile/values",
  profile_looking_for: "/onboarding/profile/looking-for",
  profile_photos: "/onboarding/profile/photos",
  profile_preview: "/onboarding/profile/preview",
  quiz: "/onboarding/quiz",
  attribution: "/onboarding/attribution",
  // V2 tutorial tour (после attribution, параллельно с фоновой верификацией)
  tutorial_intro: "/v2/tutorial/intro",
  tutorial_swipe: "/v2/tutorial/swipe",
  tutorial_chat: "/v2/tutorial/chat",
  tutorial_safety: "/v2/tutorial/safety",
  ready: "/v2/welcome", // транзитный — RPC сам переводит в active
  active: "/main",
};

/** Какой экран показать пользователю при заходе (по lifecycle + step). */
export function nextScreenFor(user: DbUser): string {
  switch (user.lifecycle_state) {
    case "blocked":
      return "/blocked";
    case "active":
    case "paused":
      return "/main";
    case "deleted":
      return "/";
    case "onboarding":
    default:
      return ONBOARDING_PATHS[user.onboarding_step] ?? "/";
  }
}
