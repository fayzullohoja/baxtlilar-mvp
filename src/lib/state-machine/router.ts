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
  // V2 ext 2026-06-28 — welcome серия (3 экрана) перед verify.
  welcome_mission: "/v2/welcome",
  welcome_safety: "/v2/welcome/safety",
  welcome_rules: "/v2/welcome/rules",
  // Mini-app (V2 Sprint 8: verification переехало на /v2/verify):
  verification_intro: "/v2/verify/intro",
  doc_upload: "/v2/verify/doc",
  selfie_upload: "/v2/verify/selfie",
  moderation_pending: "/onboarding/pending",
  needs_changes: "/onboarding/needs-changes",
  verification_rejected: "/onboarding/rejected",
  // V2 Sprint 9/10: вся анкета переехала на /v2/anketa.
  profile_basic: "/v2/anketa/basic",
  // V2 ext 2026-06-28: appearance (рост/вес/языки) между basic и family.
  profile_appearance: "/v2/anketa/appearance",
  profile_family: "/v2/anketa/family",
  profile_values: "/v2/anketa/values",
  // V2 ext 2026-06-28: marriage (формат проживания) между values и looking-for.
  profile_marriage: "/v2/anketa/marriage",
  profile_looking_for: "/v2/anketa/looking-for",
  profile_photos: "/v2/anketa/photos",
  profile_preview: "/v2/anketa/preview",
  // V2 Sprint 11: quiz + attribution на /v2.
  quiz: "/v2/quiz",
  attribution: "/v2/attribution",
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
      // Терминальный экран (C4). Раньше "/" → LocaleIndexPage снова считал
      // nextScreenFor(deleted)="/" → бесконечная петля для вернувшегося
      // удалённого юзера.
      return "/deleted";
    case "onboarding":
    default:
      return ONBOARDING_PATHS[user.onboarding_step] ?? "/";
  }
}
