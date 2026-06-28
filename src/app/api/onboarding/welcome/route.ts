import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import type { OnboardingStep } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V2 ext 2026-06-28: welcome серия из 3 экранов перед verify.
 * mission → safety → rules → verification_intro.
 *
 * POST → следующий шаг согласно карте. Параллель с /api/onboarding/tutorial.
 */
const NEXT_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  welcome_mission: "welcome_safety",
  welcome_safety: "welcome_rules",
  welcome_rules: "verification_intro",
};

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;

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
    `welcome: ${currentStep} → ${targetStep}`,
    { kind: "user", id: user.id },
  );
  if (!tr.ok) {
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS[targetStep] });
}
