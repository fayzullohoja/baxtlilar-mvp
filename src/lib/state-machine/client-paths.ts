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
  ready: "/v2/welcome",
  active: "/main",
};

export function clientNextPath(lifecycle: string, step: string): string {
  if (lifecycle === "blocked") return "/blocked";
  if (lifecycle === "active" || lifecycle === "paused") return "/main";
  // Должно совпадать с server nextScreenFor: deleted → "/". Иначе deleted-юзер со
  // step="active" уезжает на /main, гард шлёт его назад на "/" — бесконечная петля
  // редиректов (вернувшийся после удаления пользователь застревает).
  if (lifecycle === "deleted") return "/";
  return CLIENT_ONBOARDING_PATHS[step] ?? "/";
}
