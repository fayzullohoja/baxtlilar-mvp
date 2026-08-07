import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import type { OnboardingStep, VerificationStatus } from "@/lib/state-machine/types";

/**
 * Shadow-Active (V2): юзер получает lifecycle='active' ДО решения модератора.
 * Если модератор выносит needs_changes/rejected, такой юзер оказывается в
 * lifecycle='active' + verification_status=<исход>, а onboarding_step='active' —
 * то есть НЕ проходит step-гейт и раньше упирался в 409 на всех роутах
 * восстановления (перманентный тупик: плашка «нужно поправить» без пути назад).
 *
 * Разрешаем путь восстановления и для этой ветки: сверяем verification_status
 * вместо onboarding_step. lifecycle при этом НЕ меняется (юзер остаётся active).
 */
export function isRecoveryActive(user: DbUser, verification: VerificationStatus): boolean {
  return user.lifecycle_state === "active" && user.verification_status === verification;
}

/**
 * Загружает текущего пользователя для API-роута онбординга и проверяет шаг.
 * Возвращает { user } или { res } с готовым JSON-ответом (401/409).
 * Если expected не задан — проверяется только наличие сессии.
 *
 * opts.allowActiveWithVerification — дополнительно пропустить shadow-active юзера
 * с указанным verification_status (путь восстановления верификации, см. выше).
 */
export async function loadUserForStep(
  expected?: OnboardingStep,
  opts?: { allowActiveWithVerification?: VerificationStatus },
): Promise<{ user: DbUser; res?: undefined } | { user?: undefined; res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { res: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }) };
  }
  if (expected && (user.lifecycle_state !== "onboarding" || user.onboarding_step !== expected)) {
    const recovery =
      opts?.allowActiveWithVerification !== undefined &&
      isRecoveryActive(user, opts.allowActiveWithVerification);
    if (!recovery) {
      return {
        res: NextResponse.json(
          { ok: false, error: "wrong_step", current: user.onboarding_step },
          { status: 409 },
        ),
      };
    }
  }
  return { user };
}
