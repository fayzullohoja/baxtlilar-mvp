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
import { ONBOARDING_BACK } from "./router";

export type UserStatePatch = Partial<{
  lifecycle_state: LifecycleState;
  onboarding_step: OnboardingStep;
  verification_status: VerificationStatus;
  profile_completion: ProfileCompletion;
  quiz_completion: QuizCompletion;
  phone_verified: boolean;
  phone_number: string;
  language: "ru" | "uz" | "tr" | "en";
  blocked_at: string | null;
  blocked_reason: string | null;
}>;

export type TriggeredBy = { kind: "user" | "system" | "admin"; id?: string };

export class TransitionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "TransitionError";
  }
}

/**
 * Шаг человека уже НЕ тот, из которого разрешён этот переход.
 *
 * ПОЧЕМУ отдельный класс. Это единственная неудача перехода, про которую точно
 * известно: onboarding_step у человека сменился, и повтор запроса не поможет
 * никогда - надо вести человека на его настоящий экран. Все остальные неудачи
 * (пользователя не нашли, RPC отказала, графы TS и SQL разошлись) шаг НЕ
 * двигают: там как раз повтор осмыслен, а увод с экрана - вреден. Раньше
 * tryTransition сваливал их всех в 'wrong_step', и клиент молча уводил человека
 * в корень, корень возвращал на ту же страницу - кнопка «Далее» бесконечно
 * перезагружала экран без единого сообщения.
 */
export class WrongStepError extends TransitionError {
  constructor(from: string, to: string) {
    super(`disallowed onboarding_step: ${from} -> ${to}`);
    this.name = "WrongStepError";
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
 * - Проверяет разрешённость onboarding_step по ALLOWED_TRANSITIONS (guard в TS).
 * - Атомарно (одна транзакция в Postgres RPC transition_user) делает UPDATE users
 *   + INSERT в user_state_transitions с optimistic concurrency по updated_at.
 * Бросает ConcurrencyError при гонке/устаревшем updated_at, TransitionError — иначе.
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

  if (patch.onboarding_step && cur.onboarding_step !== patch.onboarding_step) {
    const allowed = ALLOWED_TRANSITIONS[cur.onboarding_step as OnboardingStep] ?? [];
    // Кнопка «Назад»: разрешаем ровно один шаг назад по каноническому V4-порядку
    // (ONBOARDING_BACK), не раздувая forward-таблицу. Идёт через тот же RPC —
    // с аудитом в user_state_transitions и optimistic concurrency.
    const back = ONBOARDING_BACK[cur.onboarding_step as OnboardingStep];
    if (!allowed.includes(patch.onboarding_step) && patch.onboarding_step !== back) {
      throw new WrongStepError(cur.onboarding_step, patch.onboarding_step);
    }
  }

  const { data, error } = await sb.rpc("transition_user", {
    p_user_id: userId,
    p_patch: patch,
    p_expected_updated_at: cur.updated_at,
    p_reason: reason,
    p_by_kind: triggeredBy.kind,
    p_by_id: triggeredBy.id ?? null,
  });
  if (error) throw new TransitionError(`transition_user rpc failed: ${error.message}`);
  const res = data as { ok: boolean; error?: string } | null;
  if (!res || !res.ok) {
    if (res?.error === "conflict") throw new ConcurrencyError();
    throw new TransitionError(res?.error ?? "transition failed");
  }
}

/**
 * Обёртка для API-роутов: не бросает на гонке/неверном шаге, а возвращает результат.
 * Фикс BUG-1: двойной submit → 409, а не 500.
 *
 * Три РАЗНЫХ исхода, и путать их нельзя - клиент по ним решает, что сказать
 * человеку (см. parseStepOutcome в src/lib/onboarding/submit-step.ts):
 *  - "conflict"          - гонка по updated_at, повтор помогает;
 *  - "wrong_step"        - шаг человека сменился, повтор не поможет никогда,
 *                          человека надо увести на его настоящий экран;
 *  - "transition_failed" - сломалась сама машина переходов (пользователя не
 *                          нашли, RPC отказала, графы TS и SQL разошлись). Шаг
 *                          при этом остался ПРЕЖНИМ, уводить человека некуда, и
 *                          молчать нельзя: надо показать ошибку.
 */
export async function tryTransition(
  userId: string,
  patch: UserStatePatch,
  reason: string,
  triggeredBy: TriggeredBy,
): Promise<{ ok: true } | { ok: false; error: "conflict" | "wrong_step" | "transition_failed" }> {
  try {
    await transition(userId, patch, reason, triggeredBy);
    return { ok: true };
  } catch (e) {
    if (e instanceof ConcurrencyError) return { ok: false, error: "conflict" };
    if (e instanceof WrongStepError) return { ok: false, error: "wrong_step" };
    if (e instanceof TransitionError) {
      // Логируем: снаружи этот код виден человеку как «что-то пошло не так», и
      // без строки в логах разбирать причину будет не по чему.
      console.error("[transition] failed:", e.message);
      return { ok: false, error: "transition_failed" };
    }
    throw e;
  }
}
