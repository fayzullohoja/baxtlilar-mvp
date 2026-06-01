/** Клиентская копия маршрутов шагов (для редиректа из TelegramInit). Держать в синхроне с router.ts. */
export const CLIENT_ONBOARDING_PATHS: Record<string, string> = {
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
  profile_family: "/onboarding/profile/family",
  profile_values: "/onboarding/profile/values",
  profile_looking_for: "/onboarding/profile/looking-for",
  profile_photos: "/onboarding/profile/photos",
  profile_preview: "/onboarding/profile/preview",
  quiz: "/onboarding/quiz",
  active: "/main",
};

export function clientNextPath(lifecycle: string, step: string): string {
  if (lifecycle === "blocked") return "/blocked";
  if (lifecycle === "active" || lifecycle === "paused") return "/main";
  return CLIENT_ONBOARDING_PATHS[step] ?? "/";
}
