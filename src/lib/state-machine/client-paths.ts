/** Клиентская копия маршрутов шагов (для редиректа из TelegramInit). Держать в синхроне с router.ts. */
export const CLIENT_ONBOARDING_PATHS: Record<string, string> = {
  // bot-шаги пользователь проходит В БОТЕ; в мини-аппе они не должны
  // показывать UI — фолбэк на /open-in-telegram, который кинет в бот.
  bot_language: "/open-in-telegram",
  bot_contact: "/open-in-telegram",
  bot_consent_pd: "/open-in-telegram",
  bot_consent_biometric: "/open-in-telegram",
  // Legacy:
  language: "/open-in-telegram",
  consent: "/open-in-telegram",
  phone_input: "/open-in-telegram",
  otp_pending: "/open-in-telegram",
  // V2 ext 2026-06-28: welcome серия (3 экрана) перед verify.
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
  // V2 ext 2026-06-28: appearance + marriage между basic+family и values+looking_for.
  profile_appearance: "/v2/anketa/appearance",
  // V3 MVP 2026-06-29:
  profile_birth_place: "/v2/anketa/birth-place",
  profile_self: "/v2/anketa/self",
  profile_family_model: "/v2/anketa/family-model",
  // V4 (2026-06-30) — Чат 2 — Анкета.md: Экраны 9 и 10 между family_model и marriage.
  profile_finance: "/v2/anketa/finance",
  profile_lifestyle: "/v2/anketa/lifestyle",
  profile_partner_extended: "/v2/anketa/partner-extended",
  profile_privacy: "/v2/anketa/privacy",
  profile_family: "/v2/anketa/family",
  profile_values: "/v2/anketa/values",
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
  ready: "/v2/welcome",
  active: "/main",
};

export function clientNextPath(lifecycle: string, step: string): string {
  if (lifecycle === "blocked") return "/blocked";
  // pending_ban (Option A) — invisible proposal, mirror active (см. router.ts).
  if (lifecycle === "active" || lifecycle === "paused" || lifecycle === "pending_ban")
    return "/main";
  // Должно совпадать с server nextScreenFor: deleted → терминальный /deleted
  // (C4). Раньше было "/", что давало бесконечную петлю редиректов у
  // вернувшегося после удаления пользователя.
  if (lifecycle === "deleted") return "/deleted";
  return CLIENT_ONBOARDING_PATHS[step] ?? "/";
}
