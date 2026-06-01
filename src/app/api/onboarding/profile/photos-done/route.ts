import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Завершение шага фото: нужно ≥1 фото → к предпросмотру. */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_photos");
  if (res) return res;

  const { count } = await supabaseAdmin()
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count) return NextResponse.json({ ok: false, error: "no_photo" }, { status: 400 });

  const tr = await tryTransition(user.id, { onboarding_step: "profile_preview" }, "photos done", {
    kind: "user",
    id: user.id,
  });
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_preview });
}
