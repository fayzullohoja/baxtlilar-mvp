/**
 * V1 → V2 Shadow Active fix. Юзер закончил селфи → попадал сюда (wait wall).
 *
 * V2 модель (Sprint 2 продуктовое решение): пока модератор проверяет
 * паспорт + селфи, юзер ПАРАЛЛЕЛЬНО заполняет анкету. Wait-wall убран.
 *
 * Стратегия: на этой странице атомарно перевести onboarding_step
 * moderation_pending → profile_basic (state machine allowed) и редиректнуть
 * на /v2/anketa/basic. verification_status остаётся pending_review —
 * модератор увидит в очереди.
 */

import { redirect } from "@/i18n/navigation";
import { requireUserAtStep } from "@/lib/state-machine/guard";
import { tryTransition } from "@/lib/state-machine/transitions";

export const dynamic = "force-dynamic";

export default async function PendingAutoAdvancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUserAtStep(locale, "moderation_pending");

  // Атомарный переход в profile_basic. ALLOWED_TRANSITIONS уже допускает
  // moderation_pending → profile_basic.
  await tryTransition(
    user.id,
    { onboarding_step: "profile_basic", profile_completion: "in_progress" },
    "shadow active: user advances to anketa while moderator reviews",
    { kind: "system", id: "shadow_active_autoadvance" },
  );

  redirect({ href: "/v2/anketa/basic", locale });
}
