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
  // V3 MVP 2026-06-29: место рождения, self, семейная модель, partner-extended.
  profile_birth_place: "/v2/anketa/birth-place",
  profile_self: "/v2/anketa/self",
  profile_family_model: "/v2/anketa/family-model",
  // V4 (2026-06-30) — Чат 2 — Анкета.md: Экраны 9 и 10.
  profile_finance: "/v2/anketa/finance",
  profile_lifestyle: "/v2/anketa/lifestyle",
  profile_partner_extended: "/v2/anketa/partner-extended",
  profile_privacy: "/v2/anketa/privacy",
  profile_family: "/v2/anketa/family",
  profile_parents: "/v2/anketa/parents",
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

/**
 * Предыдущий шаг для кнопки «Назад» (канонический V4-порядок, обратный).
 * basic — первый шаг анкеты, у него back нет (назад = верификация, не нужно).
 * Используется /api/onboarding/back и transition() (разрешает ровно один back-шаг).
 */
export const ONBOARDING_BACK: Partial<Record<OnboardingStep, OnboardingStep>> = {
  profile_appearance: "profile_basic",
  profile_birth_place: "profile_appearance",
  profile_self: "profile_birth_place",
  profile_family: "profile_self",
  // 2026-07-12: Экран 6 «Родители» — back-цепочка family ← parents ← values.
  profile_parents: "profile_family",
  profile_values: "profile_parents",
  profile_family_model: "profile_values",
  profile_finance: "profile_family_model",
  profile_lifestyle: "profile_finance",
  profile_marriage: "profile_lifestyle",
  profile_partner_extended: "profile_marriage",
  // Экран privacy убран из потока (2026-07-12) — фото сразу после partner_extended.
  // profile_privacy оставлен как back-цель для легаси-юзеров, застрявших на нём.
  profile_privacy: "profile_partner_extended",
  profile_photos: "profile_partner_extended",
  profile_preview: "profile_photos",
  quiz: "profile_preview",
  attribution: "quiz",
  tutorial_intro: "attribution",
  tutorial_swipe: "tutorial_intro",
  tutorial_chat: "tutorial_swipe",
  tutorial_safety: "tutorial_chat",
};

/** Какой экран показать пользователю при заходе (по lifecycle + step). */
export function nextScreenFor(user: DbUser): string {
  switch (user.lifecycle_state) {
    case "blocked":
      return "/blocked";
    case "active":
    case "paused":
    case "pending_ban":
      // pending_ban (Option A): treat как active — невидимый proposal.
      // Без этого case nextScreenFor падает в default → ONBOARDING_PATHS[step],
      // у banned-target step='active' → '/main', а isActiveAccessAllowed
      // отвергает pending_ban → бесконечный redirect loop (C1 class).
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
