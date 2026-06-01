import type { DbUser } from "@/lib/auth/current-user";
import type { OnboardingStep } from "./types";

/**
 * onboarding_step → путь экрана (без префикса локали).
 * Источник истины: Чат 12 §6 / Чат 13 §1.3 (порядок MVP).
 */
export const ONBOARDING_PATHS: Record<OnboardingStep, string> = {
  language: "/",
  consent: "/onboarding/consent",
  phone_input: "/onboarding/phone",
  otp_pending: "/onboarding/otp",
  doc_upload: "/onboarding/document",
  selfie_upload: "/onboarding/selfie",
  moderation_pending: "/onboarding/pending",
  needs_changes: "/onboarding/needs-changes",
  verification_rejected: "/onboarding/rejected",
  profile_basic: "/onboarding/profile/basic",
  profile_photos: "/onboarding/profile/photos",
  profile_preview: "/onboarding/profile/preview",
  quiz: "/onboarding/quiz",
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
