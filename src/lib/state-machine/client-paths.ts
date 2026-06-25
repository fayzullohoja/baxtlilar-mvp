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
  // Mini-app (V2 Sprint 8: verification переехало на /v2/verify):
  verification_intro: "/v2/verify/intro",
  doc_upload: "/v2/verify/doc",
  selfie_upload: "/v2/verify/selfie",
  moderation_pending: "/onboarding/pending",
  needs_changes: "/onboarding/needs-changes",
  verification_rejected: "/onboarding/rejected",
  // V2 Sprint 9/10: вся анкета переехала на /v2/anketa.
  profile_basic: "/v2/anketa/basic",
  profile_family: "/v2/anketa/family",
  profile_values: "/v2/anketa/values",
  profile_looking_for: "/v2/anketa/looking-for",
  profile_photos: "/v2/anketa/photos",
  profile_preview: "/v2/anketa/preview",
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
