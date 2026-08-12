import "server-only";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "./router";
import type { OnboardingStep, VerificationStatus } from "./types";

/**
 * Серверный гард для onboarding-страниц.
 * - нет сессии → на welcome (там TelegramInit пересоздаст сессию);
 * - пользователь не на ожидаемом шаге → редирект на его актуальный экран (resumable, no-skip).
 * Возвращает пользователя, если он ровно на нужном шаге.
 */
export async function requireUserAtStep(
  locale: string,
  expected: OnboardingStep,
): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  if (user!.lifecycle_state !== "onboarding" || user!.onboarding_step !== expected) {
    redirect({ href: nextScreenFor(user!), locale });
  }
  return user!;
}

/**
 * Гард экранов ПОВТОРНОЙ верификации (/onboarding/needs-changes, /onboarding/rejected).
 *
 * Парная к loadUserForVerificationRepair из guard-api.ts - и по той же причине:
 * после shadow-active решение модератора застаёт человека на любом шаге анкеты
 * или уже в lifecycle_state='active', а вернуть ему верификационный шаг нельзя
 * (таких рёбер в ALLOWED_TRANSITIONS нет). Поэтому экран починки пускает по
 * состоянию верификации, а не по шагу: иначе requireUserAtStep уводил бы
 * человека обратно в анкету, и решение модератора становилось бы необратимым.
 *
 * Не совпал статус - отправляем на его актуальный экран (тот же resumable
 * контракт, что у requireUserAtStep).
 */
export async function requireUserForVerificationRepair(
  locale: string,
  expected: VerificationStatus,
): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  if (user!.lifecycle_state === "blocked" || user!.lifecycle_state === "deleted") {
    redirect({ href: nextScreenFor(user!), locale });
  }
  if (user!.verification_status !== expected) {
    redirect({ href: nextScreenFor(user!), locale });
  }
  return user!;
}
