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
  // Mini-app onboarding:
  | "verification_intro"
  | "doc_upload"
  | "selfie_upload"
  | "moderation_pending"
  | "needs_changes"
  | "verification_rejected"
  | "profile_basic"
  | "profile_family"
  | "profile_values"
  | "profile_looking_for"
  | "profile_photos"
  | "profile_preview"
  | "quiz"
  // MAJOR #3 (spec Экран 12): между quiz и active.
  | "attribution"
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
  // Бот-регистрация (актуальный путь):
  bot_language: ["bot_contact"],
  bot_contact: ["bot_consent_pd"],
  bot_consent_pd: ["bot_consent_biometric"],
  bot_consent_biometric: ["verification_intro"],
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
  profile_basic: ["profile_family"],
  profile_family: ["profile_values"],
  profile_values: ["profile_looking_for"],
  profile_looking_for: ["profile_photos"],
  profile_photos: ["profile_preview"],
  profile_preview: ["profile_basic", "quiz"],
  quiz: ["attribution"],
  attribution: ["active"],
  active: [],
};

export const ALL_STEPS: OnboardingStep[] = Object.keys(ALLOWED_TRANSITIONS) as OnboardingStep[];
