import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { familySchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_family");
  if (res) return res;

  const parsed = familySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(user.id, { onboarding_step: "profile_values" }, "anketa: family", {
    kind: "user",
    id: user.id,
  });
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_values });
}
