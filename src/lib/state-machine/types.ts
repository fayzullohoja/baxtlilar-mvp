// Источник истины: Чат 12 §6, Чат 13 §1.2-1.5

export type LifecycleState = "onboarding" | "active" | "paused" | "blocked" | "deleted";

export type OnboardingStep =
  // Бот-регистрация (2026-06-19 security pivot, заменяет SMS-OTP):
  | "bot_language"
  | "bot_contact"
  | "bot_consent_pd"
  | "bot_consent_biometric"
  // Legacy SMS-flow — не используются, оставлены в enum для миграции:
  | "language"
  | "consent"
  | "phone_input"
  | "otp_pending"
  // Welcome серия (2026-06-28 продуктовая поправка) — 3 экрана перед verify:
  // приветствие/миссия → безопасность → правила. Tutorial остаётся ПОСЛЕ
  // анкеты как раньше (это про механику feed; welcome — про trust/missию).
  | "welcome_mission"
  | "welcome_safety"
  | "welcome_rules"
  // Mini-app onboarding:
  | "verification_intro"
  | "doc_upload"
  | "selfie_upload"
  | "moderation_pending"
  | "needs_changes"
  | "verification_rejected"
  | "profile_basic"
  // V2 extension (2026-06-28): демография (рост/вес/языки) после basic.
  | "profile_appearance"
  // V3 MVP (2026-06-29) — новые шаги анкеты:
  | "profile_birth_place" // Экран 2 — место рождения
  | "profile_self" // Экран 3 — bio + education + activity_field (Sprint 2)
  | "profile_family"
  | "profile_values"
  // V2 extension (2026-06-28): формат проживания после брака — после ценностей.
  | "profile_marriage"
  | "profile_family_model" // Экран 7 (Sprint 2)
  | "profile_partner_extended" // Экран 8 расширение (Sprint 2)
  | "profile_privacy" // Экран 16 — глобальный режим видимости (Sprint 3)
  | "profile_looking_for"
  | "profile_photos"
  | "profile_preview"
  | "quiz"
  // MAJOR #3 (spec Экран 12): между quiz и active.
  | "attribution"
  // V2 (2026-06-25 Shadow Active redesign): tutorial tour ПОСЛЕ анкеты,
  // ПАРАЛЛЕЛЬНО с фоновой верификацией. Юзер не блокируется на moderation_pending.
  | "tutorial_intro" // Объяснение Shadow Active модели
  | "tutorial_swipe" // Как работает feed / interest / like-on-specific
  | "tutorial_chat" // Как чат открывается после mutual interest
  | "tutorial_safety" // Правила безопасности + что НЕ делать
  | "ready" // V2 терминал onboarding → trigger transition в lifecycle=active
  | "active";

export type VerificationStatus =
  | "not_started"
  | "phone_verified"
  | "documents_uploaded"
  | "liveness_uploaded"
  | "pending_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "revoked";

export type ProfileCompletion = "not_started" | "in_progress" | "completed" | "pending_remoderation";
export type QuizCompletion = "not_started" | "in_progress" | "completed";

/**
 * Разрешённые переходы onboarding_step (MVP-порядок: телефон → паспорт → селфи → модерация).
 */
export const ALLOWED_TRANSITIONS: Record<OnboardingStep, OnboardingStep[]> = {
  // Бот-регистрация. V2 ext 2026-06-28 (round 2): порядок перестроен —
  // сначала оферта/правила (до передачи телефона), потом телефон, потом
  // отдельно биометрия. Источник: продакт-фидбэк учредителя.
  bot_language: ["bot_consent_pd"],
  bot_consent_pd: ["bot_contact"],
  bot_contact: ["bot_consent_biometric"],
  // V3 Sprint 3 round 3 (2026-06-29): welcome теперь одностраничный
  // branded экран → verification_intro напрямую. welcome_safety и
  // welcome_rules остались как legacy fallback для застрявших юзеров.
  bot_consent_biometric: ["welcome_mission"],
  welcome_mission: ["verification_intro"],
  welcome_safety: ["verification_intro"],
  welcome_rules: ["verification_intro"],
  // verification_intro живёт в мини-аппе (не в боте) — intro-экран перед
  // загрузкой паспорта. Retry/needs_changes минуют его (см. ниже).
  verification_intro: ["doc_upload"],
  // Legacy SMS-шаги — terminal, новых переходов нет (но валидируются как enum
  // на случай рестора старых строк):
  language: [],
  consent: [],
  phone_input: [],
  otp_pending: [],
  // Mini-app onboarding:
  doc_upload: ["selfie_upload", "needs_changes"],
  selfie_upload: ["moderation_pending", "needs_changes"],
  moderation_pending: ["needs_changes", "verification_rejected", "profile_basic"],
  needs_changes: ["doc_upload", "selfie_upload", "moderation_pending"],
  verification_rejected: ["doc_upload"],
  // V3 MVP 2026-06-29: basic → birth_place → appearance → self → family → values
  //   → family_model → marriage → partner_extended → looking_for → photos.
  // В Sprint 1 реально работает basic → birth_place → self (заглушка). Остальные
  // переходы оставлены для Sprint 2.
  profile_basic: ["profile_birth_place", "profile_appearance"],
  profile_birth_place: ["profile_appearance", "profile_self"],
  profile_appearance: ["profile_self", "profile_family"],
  // V3 Sprint 2: self → appearance (рост/вес/языки идут ПОСЛЕ self для V3 flow).
  profile_self: ["profile_appearance", "profile_family"],
  profile_family: ["profile_values"],
  // V2 ext 2026-06-28: между values и looking_for — profile_marriage (формат проживания).
  profile_values: ["profile_family_model", "profile_marriage"],
  profile_family_model: ["profile_marriage"],
  profile_marriage: ["profile_partner_extended", "profile_looking_for"],
  profile_partner_extended: ["profile_privacy", "profile_photos"],
  profile_privacy: ["profile_photos"],
  profile_looking_for: ["profile_photos"],
  profile_photos: ["profile_preview"],
  // V2 ext: preview позволяет вернуться в любой anketa-шаг (для правок).
  profile_preview: ["profile_basic", "profile_appearance", "profile_family", "profile_values", "profile_marriage", "profile_looking_for", "quiz"],
  quiz: ["attribution"],
  // V2: attribution ведёт в tutorial_intro (а не сразу в active как было в V1).
  // V1 fallback: attribution → active оставлен для legacy users.
  attribution: ["tutorial_intro", "active"],
  // V2 tutorial — 4 шага. Skip разрешён для returning users (default decision #4).
  tutorial_intro: ["tutorial_swipe", "ready"],
  tutorial_swipe: ["tutorial_chat", "ready"],
  tutorial_chat: ["tutorial_safety", "ready"],
  tutorial_safety: ["ready"],
  // ready — терминал onboarding. Trigger: lifecycle_state → 'active'
  // (verification_status может быть submitted/pending — Shadow Active).
  ready: ["active"],
  active: [],
};

export const ALL_STEPS: OnboardingStep[] = Object.keys(ALLOWED_TRANSITIONS) as OnboardingStep[];
