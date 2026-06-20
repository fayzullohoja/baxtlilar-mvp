import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/verification-intro/continue
 *
 * Юзер прочитал intro и жмёт CTA → переход verification_intro → doc_upload.
 *
 * Idempotency (risk #8): если юзер уже на doc_upload (double-tap, гонка двух
 * вкладок), возвращаем 409 alreadyAdvanced — клиент трактует как success и
 * редиректит на /onboarding/document. Это лучше, чем 4xx-toast в лицо.
 */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep();
  if (res) return res;

  if (user.onboarding_step === "doc_upload") {
    return NextResponse.json(
      { ok: false, error: "already_advanced", next: ONBOARDING_PATHS.doc_upload },
      { status: 409 },
    );
  }
  if (user.onboarding_step !== "verification_intro") {
    return NextResponse.json(
      { ok: false, error: "wrong_step", current: user.onboarding_step },
      { status: 409 },
    );
  }

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "doc_upload" },
    "user:verification_intro_acknowledged",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) {
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.doc_upload });
}
