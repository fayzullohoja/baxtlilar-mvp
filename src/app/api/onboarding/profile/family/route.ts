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
 * V2-compat: дублируем future_children_plan и в legacy children_plan
 * чтобы match-story/match-of-the-day/preview не сломались до Phase F cleanup.
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

  // V2-compat mapping: V3 future_children_plan → V2 legacy children_plan.
  // Mapping приближённый — может потеряться нюанс, но матчинг не сломается.
  const legacyChildrenPlan = legacyMap(parsed.data.future_children_plan);

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        marital_status: parsed.data.marital_status,
        has_children: parsed.data.has_children,
        future_children_plan: parsed.data.future_children_plan,
        children_plan: legacyChildrenPlan, // V2-compat для match-story
        children_count: parsed.data.children_count ?? null,
        youngest_child_age: parsed.data.youngest_child_age ?? null,
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

/** V3 future_children_plan → V2 children_plan для матчинга. */
function legacyMap(v3: string): string {
  switch (v3) {
    case "yes_soon":
    case "yes_later":
      return "want";
    case "no":
      return "have_no_more";
    case "maybe":
      return "unsure";
    case "with_partner_decide":
      return "open";
    default:
      return "na";
  }
}
