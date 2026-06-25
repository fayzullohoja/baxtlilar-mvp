/**
 * V2 Permission Layer — derived roles + permission gates.
 *
 * Источник истины: Notion V2 Architecture Blueprint § Permission Matrix.
 *
 * Архитектура:
 *   lifecycle_state + verification_status → derived role
 *   role → permissions[]
 *   API routes / UI компоненты проверяют через requirePermission()
 *
 * 4-уровневый fail-closed gate:
 *   1. middleware (auth)
 *   2. route handler withPermission()
 *   3. RPC SECURITY DEFINER в БД
 *   4. DB фильтры в match_candidates view
 */

import type {
  LifecycleState,
  VerificationStatus,
} from "@/lib/state-machine/types";

/** Производная роль из lifecycle_state + verification_status. */
export type Role =
  | "guest" // не залогинен / нет user.id
  | "onboarding" // в процессе анкеты + tutorial
  | "shadow" // lifecycle=active, verification ∈ {submitted, pending_review, needs_changes}
  | "verified" // lifecycle=active, verification=approved — ПОЛНЫЕ ПРАВА
  | "rejected" // verification=rejected (MVP: финал, no retry)
  | "paused" // lifecycle=paused (sam-paused, "общаюсь с кем-то")
  | "blocked" // lifecycle=blocked (admin ban)
  | "deleted"; // lifecycle=deleted (soft-delete, ПД стёрты)

/** Полный набор действий пользователя. */
export type Permission =
  // Self / account
  | "view_own_profile"
  | "edit_own_profile"
  | "delete_account"
  | "export_account"
  | "pause_account"
  | "resume_account"
  // Onboarding flow
  | "submit_documents"
  | "submit_quiz"
  | "submit_attribution"
  | "view_tutorial"
  // Matching / feed
  | "view_feed" // видеть чужие профили в /feed
  | "be_visible_in_feed" // появляться в чужих лентах
  | "send_interest" // отправить interest
  | "receive_interest" // получать interests
  | "view_received_interests"
  // Chat (после mutual)
  | "open_chat"
  | "send_message"
  | "view_chat_list"
  // Safety
  | "report_user"
  | "block_user"
  // Settings
  | "edit_settings"
  | "view_privacy_settings";

/** Derive role from БД-состояния. */
export function deriveRole(
  lifecycleState: LifecycleState,
  verificationStatus: VerificationStatus,
): Role {
  switch (lifecycleState) {
    case "onboarding":
      return "onboarding";
    case "deleted":
      return "deleted";
    case "blocked":
      return "blocked";
    case "paused":
      return "paused";
    case "active":
      if (verificationStatus === "approved") return "verified";
      if (verificationStatus === "rejected") return "rejected";
      // submitted / pending_review / needs_changes / not_started / phone_verified
      // — все попадают в shadow (lifecycle=active но не approved)
      return "shadow";
  }
}

/** Permission matrix per role. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  guest: [],
  onboarding: [
    "view_own_profile",
    "edit_own_profile",
    "submit_documents",
    "submit_quiz",
    "submit_attribution",
    "view_tutorial",
    "delete_account",
    "edit_settings",
    "view_privacy_settings",
  ],
  shadow: [
    // Видит свою анкету и может править
    "view_own_profile",
    "edit_own_profile",
    "view_tutorial",
    // ⚠️ НЕ "view_feed", НЕ "be_visible_in_feed"
    // ⚠️ НЕ "send_interest", НЕ "receive_interest", НЕ "open_chat"
    // Может управлять аккаунтом
    "delete_account",
    "export_account",
    "edit_settings",
    "view_privacy_settings",
  ],
  verified: [
    "view_own_profile",
    "edit_own_profile",
    "delete_account",
    "export_account",
    "pause_account",
    "view_tutorial",
    // Полный доступ к matching
    "view_feed",
    "be_visible_in_feed",
    "send_interest",
    "receive_interest",
    "view_received_interests",
    // Чат после mutual
    "open_chat",
    "send_message",
    "view_chat_list",
    // Safety
    "report_user",
    "block_user",
    "edit_settings",
    "view_privacy_settings",
  ],
  paused: [
    // Аналог verified но НЕ виден другим, НЕ может send_interest.
    // V2 Sprint 5 уточнение: paused сохраняет возможность отвечать в
    // существующих чатах и safety-actions (block/report) — отказ от этого
    // ломал бы текущие отношения пользователя на паузе.
    "view_own_profile",
    "edit_own_profile",
    "delete_account",
    "export_account",
    "resume_account",
    "view_chat_list",
    "open_chat",
    "send_message",
    "block_user",
    "report_user",
    "edit_settings",
    "view_privacy_settings",
  ],
  rejected: [
    // Read-only — может только смотреть статус "отказано" + delete account
    "view_own_profile",
    "delete_account",
    "export_account",
    "edit_settings",
    "view_privacy_settings",
  ],
  blocked: [
    // banned-экран. Может только delete + export (GDPR).
    "delete_account",
    "export_account",
  ],
  deleted: [],
};

/** Check permission. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Throw if no permission. */
export class PermissionDeniedError extends Error {
  constructor(
    public role: Role,
    public permission: Permission,
  ) {
    super(`Permission denied: role=${role}, required=${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(role, permission);
  }
}

/** Human-readable роль для UI копи (плашки, badge). */
export const ROLE_LABEL: Record<Role, { ru: string; uz: string }> = {
  guest: { ru: "Гость", uz: "Mehmon" },
  onboarding: { ru: "Регистрация", uz: "Roʻyxatdan oʻtish" },
  shadow: { ru: "В очереди на верификацию", uz: "Tasdiqlash navbatida" },
  verified: { ru: "Подтверждён", uz: "Tasdiqlangan" },
  rejected: { ru: "Отказано в верификации", uz: "Tasdiqlash rad etildi" },
  paused: { ru: "На паузе", uz: "Toʻxtatilgan" },
  blocked: { ru: "Заблокирован", uz: "Bloklangan" },
  deleted: { ru: "Удалён", uz: "Oʻchirilgan" },
};
