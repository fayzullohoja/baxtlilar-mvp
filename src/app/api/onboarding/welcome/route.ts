import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import type { OnboardingStep } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 3 round 3 — Branded welcome (single screen).
 *
 * Заменили 3-экранную editorial серию на одну страницу. Welcome теперь:
 *   welcome_mission → verification_intro (одним переходом)
 *
 * welcome_safety и welcome_rules остались в enum как legacy fallback —
 * если кто-то застрял на этих шагах, они проводят через verification_intro.
 */
const NEXT_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  welcome_mission: "verification_intro",
  // Legacy fallback для юзеров застрявших на старых шагах:
  welcome_safety: "verification_intro",
  welcome_rules: "verification_intro",
};

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;

  // Bug #4 (2026-06-30): tutorial делает ready→active двумя транзакциями. Если
  // вторая упала, юзер залипает на step=ready с lifecycle=onboarding. Router
  // отправит его на /v2/welcome, CTA должна провести финальный переход.
  // ALLOWED_TRANSITIONS.ready = ["active"], так что транзишн валиден.
  if (user.lifecycle_state === "onboarding" && user.onboarding_step === "ready") {
    const tr = await tryTransition(
      user.id,
      { onboarding_step: "active", lifecycle_state: "active" },
      "welcome: ready → active (recovery from interrupted tutorial)",
      { kind: "user", id: user.id },
    );
    if (!tr.ok) {
      return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, next: "/main" });
  }

  if (
    user.lifecycle_state !== "onboarding" ||
    !user.onboarding_step.startsWith("welcome_")
  ) {
    return NextResponse.json(
      { ok: false, error: "wrong_step", current: user.onboarding_step },
      { status: 409 },
    );
  }

  const currentStep = user.onboarding_step as OnboardingStep;
  const targetStep = NEXT_STEP[currentStep];
  if (!targetStep) {
    return NextResponse.json(
      { ok: false, error: "no_next_step", current: currentStep },
      { status: 409 },
    );
  }

  const tr = await tryTransition(
    user.id,
    { onboarding_step: targetStep },
    `welcome v3: ${currentStep} → ${targetStep}`,
    { kind: "user", id: user.id },
  );
  if (!tr.ok) {
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS[targetStep] });
}
