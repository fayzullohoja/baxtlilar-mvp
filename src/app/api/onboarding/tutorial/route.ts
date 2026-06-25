import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import type { OnboardingStep } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V2 (2026-06-25): tutorial-тур из 4 экранов.
 *
 * POST { skip?: boolean }
 *   - skip=false (default): следующий tutorial-шаг ИЛИ ready (после safety).
 *   - skip=true: пропускаем оставшиеся шаги, сразу в ready.
 *
 * Из ready API сразу делает ready → active (+ lifecycle_state=active +
 * tutorial_seen_at=now) — это бесшовный финал тура. Если второй переход
 * упал — пользователь застрянет в ready, при следующем заходе клиент-роутер
 * приведёт обратно на /v2/welcome и юзер ткнёт CTA → повторим.
 *
 * Не валидирует тип шага явно — полагается на ALLOWED_TRANSITIONS guard в
 * transition(): попытка из не-tutorial шага получит 409 wrong_step.
 */

/** Карта tutorial_step → следующий шаг (без skip). */
const NEXT_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  tutorial_intro: "tutorial_swipe",
  tutorial_swipe: "tutorial_chat",
  tutorial_chat: "tutorial_safety",
  tutorial_safety: "ready",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;

  // Только tutorial_* шаги обслуживает этот route. Остальные → 409.
  if (
    user.lifecycle_state !== "onboarding" ||
    !user.onboarding_step.startsWith("tutorial_")
  ) {
    return NextResponse.json(
      { ok: false, error: "wrong_step", current: user.onboarding_step },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { skip?: boolean };
  const skip = body.skip === true;

  const currentStep = user.onboarding_step as OnboardingStep;
  // Skip минует промежуточные шаги — сразу в ready (ALLOWED_TRANSITIONS
  // позволяет ready из всех tutorial_*).
  const targetStep: OnboardingStep = skip ? "ready" : (NEXT_STEP[currentStep] ?? "ready");

  // Шаг 1: переход на промежуточный или ready.
  const t1 = await tryTransition(
    user.id,
    { onboarding_step: targetStep },
    skip ? `tutorial: skip from ${currentStep}` : `tutorial: next ${currentStep} → ${targetStep}`,
    { kind: "user", id: user.id },
  );
  if (!t1.ok) {
    return NextResponse.json({ ok: false, error: t1.error }, { status: 409 });
  }

  // Если не дошли до ready — возвращаем next-path и выходим.
  if (targetStep !== "ready") {
    return NextResponse.json({ ok: true, next: ONBOARDING_PATHS[targetStep] });
  }

  // Шаг 2: ready → active + lifecycle_state=active + tutorial_seen_at=now.
  // tutorial_seen_at — наружу патча transition нельзя (UserStatePatch не знает
  // про это поле), поэтому пишем отдельным UPDATE до перехода в active.
  const { error: upErr } = await supabaseAdmin()
    .from("users")
    .update({ tutorial_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (upErr) {
    console.error("[tutorial] tutorial_seen_at update failed:", upErr.message);
    // Не критично — продолжаем переход. Аналитика недополучит timestamp.
  }

  const t2 = await tryTransition(
    user.id,
    { onboarding_step: "active", lifecycle_state: "active" },
    "tutorial: ready → active (V2 shadow active)",
    { kind: "user", id: user.id },
  );
  if (!t2.ok) {
    // Юзер в ready — при следующем заходе клиент-роутер выведет на /v2/welcome
    // и кнопка "Готово" повторит финал.
    return NextResponse.json({ ok: false, error: t2.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, next: "/main" });
}
