import "server-only";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "./router";
import type { OnboardingStep } from "./types";

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
