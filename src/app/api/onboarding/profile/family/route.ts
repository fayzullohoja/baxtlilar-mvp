import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { familyChildrenSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 2 — Экран 5 «О семье и детях» (расширенный).
 *
 * Поля: marital_status, has_children, future_children_plan, children_count
 * (conditional), youngest_child_age (conditional).
 *
 * Sprint 3 cleanup: убрали V2-compat dual-write — все consumers (match-story,
 * match-of-the-day, preview, profile, admin ProfileTab, RevealedProfile)
 * мигрированы на future_children_plan.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_family");
  if (res) return res;

  const parsed = familyChildrenSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();
  // Ревью оунера Экран 5: children_living (с кем живут дети) — COLD, extended.family.
  // read-merge-write, чтобы не затирать чужие секции extended.
  const { data: prof } = await sb
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ext = (prof?.extended as Record<string, unknown>) ?? {};
  const familySection = (ext.family as Record<string, unknown>) ?? {};
  const newExtended = parsed.data.children_living
    ? {
        ...ext,
        family: { ...familySection, children_living: parsed.data.children_living },
      }
    : ext;

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        marital_status: parsed.data.marital_status,
        has_children: parsed.data.has_children,
        future_children_plan: parsed.data.future_children_plan,
        children_count: parsed.data.children_count ?? null,
        youngest_child_age: parsed.data.youngest_child_age ?? null,
        extended: newExtended,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_values" },
    "anketa v3: family children",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_values });
}
