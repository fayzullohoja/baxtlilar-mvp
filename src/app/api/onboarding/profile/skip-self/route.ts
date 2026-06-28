import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 1 — Skip заглушки /v2/anketa/self. Двигает profile_self →
 * profile_appearance (legacy V2 ext flow). Sprint 2 удалит этот route
 * и заменит реальной формой "О себе".
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_self");
  if (res) return res;

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_appearance" },
    "v3 sprint1: skip self stub → appearance",
    { kind: "user", id: user.id },
  );
  if (!tr.ok)
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_appearance });
}
