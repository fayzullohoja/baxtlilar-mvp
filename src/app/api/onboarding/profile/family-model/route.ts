import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { familyModelSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 2 — Экран 7 «Семейная модель» (NEW).
 *
 * Hot колонки: family_role_model, wife_work_after_marriage_view (required).
 * Cold (→ extended.family.{decision_model,household_responsibility_model}):
 *   family_decision_model, household_responsibility_model (optional).
 *
 * V4 (2026-07-01): после family_model переход теперь идёт в profile_finance
 * (Чат-2 Экран 9), затем profile_lifestyle (Экран 10), только потом в
 * profile_marriage. До V4 переход шёл сразу в marriage — финансы и образ жизни
 * были недостижимы.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_family_model");
  if (res) return res;

  const parsed = familyModelSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  // Hot → колонки. Cold (decision_model, household_responsibility) → extended.family.
  const hotUpdate: Record<string, unknown> = {
    user_id: user.id,
    family_role_model: parsed.data.family_role_model,
    wife_work_after_marriage_view: parsed.data.wife_work_after_marriage_view,
  };

  // Если есть cold-поля — мержим в extended.
  if (parsed.data.family_decision_model || parsed.data.household_responsibility_model) {
    // Сначала прочитаем текущий extended чтобы не затереть остальные секции.
    const { data: existing, error: readErr } = await supabaseAdmin()
      .from("user_profiles")
      .select("extended")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readErr)
      return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
    const ext = (existing?.extended as Record<string, unknown>) ?? {};
    const family = (ext.family as Record<string, unknown>) ?? {};
    const newFamily = {
      ...family,
      ...(parsed.data.family_decision_model
        ? { decision_model: parsed.data.family_decision_model }
        : {}),
      ...(parsed.data.household_responsibility_model
        ? { household_responsibility_model: parsed.data.household_responsibility_model }
        : {}),
    };
    hotUpdate.extended = { ...ext, family: newFamily };
  }

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(hotUpdate, { onConflict: "user_id" });
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_finance" },
    "anketa v4: family-model → finance",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_finance });
}
