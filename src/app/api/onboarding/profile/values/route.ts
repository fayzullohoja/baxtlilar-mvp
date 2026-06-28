import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { valuesV3Schema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 2 — Экран 6 «Ценности и вера» (rework).
 *
 * Изменения относительно V2:
 * - values text[] → top_life_values text[] (14 опций V3 вместо 9 V2)
 * - education и employment вынесены на Экран 3 (self)
 * - Шкала religion_importance НЕ возвращается (учредитель сказал оставить
 *   мою поправку — religion_practice 4 опции)
 *
 * V2-compat: дублируем top_life_values и в legacy values[] чтобы
 * match-of-the-day/preview не сломались до Phase F cleanup.
 *
 * После values → profile_family_model (Sprint 2 экран 7).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_values");
  if (res) return res;

  const parsed = valuesV3Schema.safeParse(await req.json().catch(() => ({})));
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
        religion: parsed.data.religion,
        religion_practice: parsed.data.religion_practice,
        religion_partner_match: parsed.data.religion_partner_match ?? null,
        top_life_values: parsed.data.top_life_values,
        values: parsed.data.top_life_values, // V2-compat alias до Phase F
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // V3 Sprint 2: после values → profile_family_model (Sprint 2 Экран 7).
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_family_model" },
    "anketa v3: values reworked",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_family_model });
}
