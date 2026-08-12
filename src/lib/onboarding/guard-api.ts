import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import type { OnboardingStep, VerificationStatus } from "@/lib/state-machine/types";

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
    // lifecycle отдаём вместе с шагом: клиент по этой паре сразу считает
    // настоящий экран человека (clientNextPath). Без lifecycle заблокированный
    // или удалённый уехал бы сначала в анкету и только потом был бы отбит
    // серверным гардом - лишний скачок на ровном месте.
    return {
      res: NextResponse.json(
        {
          ok: false,
          error: "wrong_step",
          current: user.onboarding_step,
          lifecycle: user.lifecycle_state,
        },
        { status: 409 },
      ),
    };
  }
  return { user };
}

/**
 * Загружает пользователя для роута ПОВТОРНОЙ подачи документов.
 *
 * ПОЧЕМУ отдельная функция, а не loadUserForStep. Shadow-active (миграция
 * 20260625000000) расщепил две оси, которые раньше совпадали: «где человек в
 * анкете» (onboarding_step) и «что с его верификацией» (verification_status).
 * Модератор может вынести решение, когда человек уже ушёл в анкету или даже
 * опубликовался и стал lifecycle_state='active'. Гейт по точному шагу в такой
 * ситуации не выполним НИКОГДА: шаг у человека анкетный, а вернуть ему
 * doc_upload/needs_changes нельзя - таких рёбер в ALLOWED_TRANSITIONS нет, и
 * именно эта сырая подмена шага роняла ему сохранение анкеты в 409 (прод,
 * 12.08.2026). Поэтому дорога назад гейтится состоянием ВЕРИФИКАЦИИ.
 *
 * Что проверяем: verification_status входит в expected. Шаг и lifecycle -
 * намеренно нет, кроме терминальных состояний аккаунта (заблокированному и
 * удалённому в очередь модерации не надо).
 *
 * Категорию отказа (blocking - подделка/катфиш/несовершеннолетний) здесь НЕ
 * смотрим: это отдельная проверка по user_documents в самом роуте, как в
 * /api/onboarding/retry.
 */
export async function loadUserForVerificationRepair(
  expected: readonly VerificationStatus[],
): Promise<{ user: DbUser; res?: undefined } | { user?: undefined; res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { res: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }) };
  }
  if (user.lifecycle_state === "blocked" || user.lifecycle_state === "deleted") {
    return { res: NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 }) };
  }
  if (!expected.includes(user.verification_status)) {
    return {
      res: NextResponse.json(
        { ok: false, error: "wrong_verification_status", current: user.verification_status },
        { status: 409 },
      ),
    };
  }
  return { user };
}
