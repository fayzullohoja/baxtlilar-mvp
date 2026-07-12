import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_BACK, ONBOARDING_PATHS } from "@/lib/state-machine/router";
import type { OnboardingStep } from "@/lib/state-machine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Кнопка «Назад» — один шаг назад по каноническому V4-порядку (ONBOARDING_BACK).
 * Двигает onboarding_step назад через tryTransition (аудит + optimistic concurrency),
 * чтобы гард предыдущего экрана пропустил юзера и он мог отредактировать ответы.
 * У первого шага анкеты (basic) back-цели нет → 409 no_back (кнопка не показывается).
 */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;
  if (user.lifecycle_state !== "onboarding") {
    return NextResponse.json({ ok: false, error: "not_onboarding" }, { status: 409 });
  }
  const prev = ONBOARDING_BACK[user.onboarding_step as OnboardingStep];
  if (!prev) {
    return NextResponse.json({ ok: false, error: "no_back" }, { status: 409 });
  }
  const tr = await tryTransition(
    user.id,
    { onboarding_step: prev },
    "anketa: back button",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) {
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS[prev] });
}
