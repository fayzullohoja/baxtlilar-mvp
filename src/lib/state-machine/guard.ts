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
 *
 * opts.allowActiveWithVerification — пропустить также shadow-active юзера
 * (lifecycle='active') с указанным verification_status. Нужно для пути
 * восстановления: в Shadow-Active модели решение модератора needs_changes
 * приходит к УЖЕ активному юзеру, у которого onboarding_step='active', поэтому
 * step-гейт его отвергал и экран перезагрузки документов был недостижим.
 */
export async function requireUserAtStep(
  locale: string,
  expected: OnboardingStep,
  opts?: { allowActiveWithVerification?: VerificationStatus },
): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/", locale });
  const atStep =
    user!.lifecycle_state === "onboarding" && user!.onboarding_step === expected;
  const recovery =
    opts?.allowActiveWithVerification !== undefined &&
    user!.lifecycle_state === "active" &&
    user!.verification_status === opts.allowActiveWithVerification;
  if (!atStep && !recovery) {
    redirect({ href: nextScreenFor(user!), locale });
  }
  return user!;
}
