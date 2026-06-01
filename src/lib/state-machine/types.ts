// Источник истины: Чат 12 §6, Чат 13 §1.2-1.5

export type LifecycleState = "onboarding" | "active" | "paused" | "blocked" | "deleted";

export type OnboardingStep =
  | "language"
  | "consent"
  | "phone_input"
  | "otp_pending"
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
  language: ["consent"],
  consent: ["phone_input"],
  phone_input: ["otp_pending"],
  otp_pending: ["phone_input", "doc_upload"], // повтор кода или успех
  doc_upload: ["selfie_upload", "needs_changes"],
  selfie_upload: ["moderation_pending", "needs_changes"],
  moderation_pending: ["needs_changes", "verification_rejected", "profile_basic"],
  needs_changes: ["doc_upload", "selfie_upload", "moderation_pending"],
  verification_rejected: ["doc_upload"], // повторная попытка, если разрешена
  profile_basic: ["profile_family"],
  profile_family: ["profile_values"],
  profile_values: ["profile_looking_for"],
  profile_looking_for: ["profile_photos"],
  profile_photos: ["profile_preview"],
  profile_preview: ["profile_basic", "quiz"], // edit (назад к началу анкеты) или publish
  quiz: ["active"],
  active: [],
};

export const ALL_STEPS: OnboardingStep[] = Object.keys(ALLOWED_TRANSITIONS) as OnboardingStep[];
