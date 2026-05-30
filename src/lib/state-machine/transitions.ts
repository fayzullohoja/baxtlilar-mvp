import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ALLOWED_TRANSITIONS,
  type LifecycleState,
  type OnboardingStep,
  type ProfileCompletion,
  type QuizCompletion,
  type VerificationStatus,
} from "./types";

export type UserStatePatch = Partial<{
  lifecycle_state: LifecycleState;
  onboarding_step: OnboardingStep;
  verification_status: VerificationStatus;
  profile_completion: ProfileCompletion;
  quiz_completion: QuizCompletion;
  phone_verified: boolean;
  phone_number: string;
  language: "ru" | "uz";
}>;

export type TriggeredBy = { kind: "user" | "system" | "admin"; id?: string };

export class TransitionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "TransitionError";
  }
}
export class ConcurrencyError extends Error {
  constructor() {
    super("optimistic concurrency conflict");
    this.name = "ConcurrencyError";
  }
}

/**
 * Единственный путь смены статусов пользователя.
 * - Проверяет разрешённость перехода onboarding_step по ALLOWED_TRANSITIONS.
 * - Optimistic concurrency через WHERE updated_at = старое значение.
 * - Пишет по одной строке в user_state_transitions на каждое изменённое поле.
 */
export async function transition(
  userId: string,
  patch: UserStatePatch,
  reason: string,
  triggeredBy: TriggeredBy,
): Promise<void> {
  if (!reason) throw new TransitionError("reason is required");

  const sb = supabaseAdmin();

  const { data: cur, error: e1 } = await sb.from("users").select("*").eq("id", userId).single();
  if (e1 || !cur) throw new TransitionError(`user ${userId} not found`);

  // guard onboarding_step
  if (patch.onboarding_step && cur.onboarding_step !== patch.onboarding_step) {
    const allowed = ALLOWED_TRANSITIONS[cur.onboarding_step as OnboardingStep] ?? [];
    if (!allowed.includes(patch.onboarding_step)) {
      throw new TransitionError(
        `disallowed onboarding_step: ${cur.onboarding_step} -> ${patch.onboarding_step}`,
      );
    }
  }

  const updatedAt = cur.updated_at;
  const { data: upd, error: e2 } = await sb
    .from("users")
    .update(patch)
    .eq("id", userId)
    .eq("updated_at", updatedAt)
    .select("*")
    .single();
  if (e2 || !upd) throw new ConcurrencyError();

  const rows = Object.entries(patch)
    .filter(([k, v]) => (cur as Record<string, unknown>)[k] !== v)
    .map(([k, v]) => ({
      user_id: userId,
      field: k,
      from_value:
        (cur as Record<string, unknown>)[k] == null
          ? null
          : String((cur as Record<string, unknown>)[k]),
      to_value: v == null ? null : String(v),
      reason,
      triggered_by_kind: triggeredBy.kind,
      triggered_by_id: triggeredBy.id ?? null,
    }));
  if (rows.length) {
    const { error: e3 } = await sb.from("user_state_transitions").insert(rows);
    if (e3) throw new Error(`audit insert failed: ${e3.message}`);
  }
}
