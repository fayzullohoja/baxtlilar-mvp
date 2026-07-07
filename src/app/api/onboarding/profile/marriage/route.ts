import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { marriageSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V2 ext 2026-06-28: новый шаг анкеты — формат проживания после брака.
 * Между profile_values и profile_looking_for. Required для serious-marriage
 * платформы — ключевой матчинг-сигнал.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_marriage");
  if (res) return res;

  const parsed = marriageSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        error: "validation",
        detail: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        post_marriage_living: parsed.data.post_marriage_living,
        marriage_readiness: parsed.data.marriage_readiness ?? null,
        relocation_readiness: parsed.data.relocation_readiness ?? null,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // V3 Sprint 2: после marriage → partner_extended (расширенные ожидания).
  // Legacy looking_for оставлен как fallback в ALLOWED_TRANSITIONS.
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_partner_extended" },
    "anketa v3: marriage → partner_extended",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_partner_extended });
}
