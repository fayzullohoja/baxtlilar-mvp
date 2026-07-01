import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lifestyleSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 10 «Образ жизни и привычки».
 *
 * Required: lifestyle_pace, free_time_activities (1-3), daily_routine.
 * Optional (sensitive, скрываются до mutual interest даже после публикации):
 *   bad_habits_level, nutrition_style, alcohol_level, drugs_use.
 *
 * Все поля cold → пишутся целиком в extended.lifestyle, ни одно не hot
 * (см. HOT_COLUMNS в schemas.ts). Читаем текущий extended, мержим свою
 * секцию, upsert обратно — чтобы не затереть соседние секции (finance,
 * family, privacy и т.д.).
 *
 * После lifestyle → profile_marriage.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_lifestyle");
  if (res) return res;

  const parsed = lifestyleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  // Читаем текущий extended, чтобы не затереть остальные секции.
  const { data: existing } = await supabaseAdmin()
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ext = (existing?.extended as Record<string, unknown>) ?? {};
  const lifestyle = (ext.lifestyle as Record<string, unknown>) ?? {};

  const newLifestyle: Record<string, unknown> = {
    ...lifestyle,
    lifestyle_pace: parsed.data.lifestyle_pace,
    free_time_activities: parsed.data.free_time_activities,
    daily_routine: parsed.data.daily_routine,
    ...(parsed.data.bad_habits_level
      ? { bad_habits_level: parsed.data.bad_habits_level }
      : {}),
    ...(parsed.data.nutrition_style
      ? { nutrition_style: parsed.data.nutrition_style }
      : {}),
    ...(parsed.data.alcohol_level
      ? { alcohol_level: parsed.data.alcohol_level }
      : {}),
    ...(parsed.data.drugs_use ? { drugs_use: parsed.data.drugs_use } : {}),
  };

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        extended: { ...ext, lifestyle: newLifestyle },
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_marriage" },
    "anketa v4: lifestyle",
    { kind: "user", id: user.id },
  );
  if (!tr.ok)
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({
    ok: true,
    next: ONBOARDING_PATHS.profile_marriage,
  });
}
