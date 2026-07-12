import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { privacySchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Экран 16 «Приватность» — LEGACY pass-through (с 2026-07-12).
 *
 * Экран убран из потока: новые юзеры идут partner_extended → photos напрямую
 * и сюда НЕ попадают. Роут сохранён, чтобы in-flight юзеры, застрявшие на
 * onboarding_step='profile_privacy', могли сохранить profile_visibility_mode
 * и уйти дальше (privacy → profile_photos). Только глобальный
 * profile_visibility_mode; per-block visibility отложен.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_privacy");
  if (res) return res;

  const parsed = privacySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        profile_visibility_mode: parsed.data.profile_visibility_mode,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_photos" },
    "anketa v3: privacy → photos",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_photos });
}
