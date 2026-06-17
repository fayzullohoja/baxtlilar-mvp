import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lookingForSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_looking_for");
  if (res) return res;

  const parsed = lookingForSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });

  const sb = supabaseAdmin();
  // Пол партнёра не спрашиваем: выводим автоматически как противоположный своему
  // (платформа только для разнополых пар; свой пол указан на шаге «Основное»).
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
    .upsert({ user_id: user.id, ...parsed.data, looking_for_gender }, { onConflict: "user_id" });
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_photos" },
    "anketa: looking_for",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_photos });
}
