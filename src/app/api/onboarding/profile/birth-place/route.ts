import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { birthPlaceSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anketa V3 Sprint 1 — Экран 2 «Место рождения».
 * Hot-колонки: birth_country, birth_region, birth_district, birth_city.
 * Без cold/extended payload — все 4 поля hot.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_birth_place");
  if (res) return res;

  const parsed = birthPlaceSchema.safeParse(await req.json().catch(() => ({})));
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
        birth_country: parsed.data.birth_country,
        birth_region: parsed.data.birth_region ?? null,
        birth_district: parsed.data.birth_district ?? null,
        birth_city: parsed.data.birth_city ?? null,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // Sprint 1: переходим в profile_self (где сейчас заглушка). Sprint 2 заменит
  // заглушку реальной формой "О себе".
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_self" },
    "anketa v3: birth-place saved",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_self });
}
