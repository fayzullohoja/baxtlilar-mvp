import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import type { OnboardingStep } from "@/lib/state-machine/types";

/**
 * Загружает текущего пользователя для API-роута онбординга и проверяет шаг.
 * Возвращает { user } или { res } с готовым JSON-ответом (401/409).
 * Если expected не задан — проверяется только наличие сессии.
 */
export async function loadUserForStep(
  expected?: OnboardingStep,
): Promise<{ user: DbUser; res?: undefined } | { user?: undefined; res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { res: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }) };
  }
  if (expected && (user.lifecycle_state !== "onboarding" || user.onboarding_step !== expected)) {
    return {
      res: NextResponse.json(
        { ok: false, error: "wrong_step", current: user.onboarding_step },
        { status: 409 },
      ),
    };
  }
  return { user };
}
