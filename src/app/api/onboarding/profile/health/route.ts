import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { healthSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { stampExtended } from "@/lib/profile/extended";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * §11 «Здоровье и особые обстоятельства» (ревью оунера 2026-07-14). Между
 * lifestyle (Экран 10) и marriage.
 *
 * Оба поля optional (чувствительные — можно пропустить):
 *   health_openness           — важность открытости в вопросах здоровья;
 *   medical_check_willingness — готовность к добров. совместной медпроверке.
 *
 * Baxtlilar НЕ собирает диагнозы/справки/результаты. Всё COLD → extended.health,
 * visibility=matching_only (не в progressive-view whitelist → не утекает pre-mutual).
 * health → profile_marriage.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_health");
  if (res) return res;

  const parsed = healthSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const { data: existing, error: readErr } = await supabaseAdmin()
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr)
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  const ext = (existing?.extended as Record<string, unknown>) ?? {};
  const health = (ext.health as Record<string, unknown>) ?? {};

  const newHealth: Record<string, unknown> = {
    ...health,
    _visibility: "matching_only",
    ...(parsed.data.health_openness
      ? { health_openness: parsed.data.health_openness }
      : {}),
    ...(parsed.data.medical_check_willingness
      ? { medical_check_willingness: parsed.data.medical_check_willingness }
      : {}),
    // Ревью оунера 1.10 (substance): safety_only — НЕ показывается другим юзерам,
    // не в публичной анкете (в progressive-view whitelist не входит). Флаг
    // ready_to_discuss помечает на будущий внутренний safety-review (воркфлоу пока нет).
    ...(parsed.data.substance_dependency_status
      ? {
          substance_dependency_status: parsed.data.substance_dependency_status,
          substance_visibility: "safety_only",
          ...(parsed.data.substance_dependency_status === "ready_to_discuss"
            ? { later_safety_review: true }
            : {}),
        }
      : {}),
  };

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      { user_id: user.id, extended: stampExtended({ ...ext, health: newHealth }) },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_marriage" },
    "anketa: health → marriage",
    { kind: "user", id: user.id },
  );
  if (!tr.ok)
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_marriage });
}
