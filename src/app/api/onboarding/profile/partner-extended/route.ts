import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { partnerExtendedSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 *
 * Поля:
 * - partner_age_min/max (required)
 * - partner_height_min/max (optional)
 * - partner_top_qualities[] (required, 1-5)
 *
 * Пол партнёра выводится автоматически как противоположный своему
 * (как и в legacy looking_for).
 *
 * После partner_extended → profile_photos (минуем legacy profile_looking_for).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_partner_extended");
  if (res) return res;

  const parsed = partnerExtendedSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();

  // Авто-вывод looking_for_gender (как в legacy looking-for).
  const { data: prof } = await sb
    .from("user_profiles")
    .select("gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const ownGender = prof?.gender as string | undefined;
  if (ownGender !== "m" && ownGender !== "f")
    return NextResponse.json({ ok: false, error: "no_gender" }, { status: 409 });
  const looking_for_gender = ownGender === "m" ? "f" : "m";

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        partner_age_min: parsed.data.partner_age_min,
        partner_age_max: parsed.data.partner_age_max,
        partner_height_min: parsed.data.partner_height_min ?? null,
        partner_height_max: parsed.data.partner_height_max ?? null,
        partner_top_qualities: parsed.data.partner_top_qualities,
        looking_for_gender,
        // V2-compat: legacy geo_preference дефолт
        geo_preference: "my_city",
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_photos" },
    "anketa v3: partner-extended",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_photos });
}
