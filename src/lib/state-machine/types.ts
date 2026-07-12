// Источник истины: Чат 12 §6, Чат 13 §1.2-1.5

// pending_ban — внутреннее предложение блокировки (two-admin rule, 24h auto-cancel).
// Option A политика: user видит и пользуется аппом как до propose; видимый блок только
// при admin_ban_confirm → lifecycle='blocked'. См. deriveRole / isActiveAccessAllowed /
// nextScreenFor — все три обрабатывают pending_ban как active.
export type LifecycleState = "onboarding" | "active" | "paused" | "pending_ban" | "blocked" | "deleted";

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
  // V4 (2026-06-30) — новые экраны из Чат 2 — Анкета.md:
  | "profile_finance" // Экран 9 — Финансы и материальная стабильность
  | "profile_lifestyle" // Экран 10 — Образ жизни и привычки
  | "profile_partner_extended" // Экран 8 расширение (Sprint 2)
  | "profile_privacy" // Экран 16 — LEGACY с 2026-07-12: экран убран из потока; видимость живёт дефолтом 'verified_only'
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
  // 2026-07-10 (спец оунера): согласие на биометрию перенесено из бота в
  // mini-app (экран верификации, перед документом/селфи). Новый путь: телефон
  // → welcome_mission напрямую. bot_consent_biometric оставлен целью для
  // юзеров, застрявших на нём до катовера (legacy bio:* handler ещё жив).
  bot_contact: ["welcome_mission", "bot_consent_biometric"],
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
  // V4 2026-06-30 (Чат 2 — Анкета.md) — новый порядок:
  //   basic → appearance → birth_place → self → family → values → family_model
  //     → finance → lifestyle → marriage → partner_extended → privacy → photos → preview.
  //
  //   Изменения относительно V3:
  //   • Swap: appearance <-> birth_place (учредитель: №4).
  //   • Новые шаги: finance (Чат-2 Экран 9), lifestyle (Экран 10) — между
  //     family_model и marriage.
  //   • looking_for больше не в основном потоке (partner_extended делает всё).
  //     Оставляем back-edge из preview для legacy юзеров.
  //   • В profile_basic оставлены обе back-edges на случай in-flight юзеров,
  //     чтоб миграция не заперла их в пустоту.
  profile_basic: ["profile_appearance", "profile_birth_place"],
  profile_appearance: ["profile_birth_place", "profile_self"],
  profile_birth_place: ["profile_self", "profile_family"],
  profile_self: ["profile_family"],
  profile_family: ["profile_values"],
  profile_values: ["profile_family_model"],
  profile_family_model: ["profile_finance", "profile_marriage"],
  profile_finance: ["profile_lifestyle"],
  profile_lifestyle: ["profile_marriage"],
  profile_marriage: ["profile_partner_extended"],
  // 2026-07-12: экран privacy убран из потока — partner_extended → photos напрямую.
  profile_partner_extended: ["profile_photos"],
  profile_privacy: ["profile_photos"], // legacy pass-through: застрявший юзер → photos
  profile_looking_for: ["profile_photos"], // legacy back-compat only
  profile_photos: ["profile_preview"],
  // V4: preview позволяет вернуться в любой anketa-шаг (для правок).
  profile_preview: [
    "profile_basic",
    "profile_appearance",
    "profile_birth_place",
    "profile_self",
    "profile_family",
    "profile_values",
    "profile_family_model",
    "profile_finance",
    "profile_lifestyle",
    "profile_marriage",
    "profile_partner_extended",
    // profile_privacy убран (2026-07-12) — экран больше не редактируется из preview.
    "quiz",
  ],
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
