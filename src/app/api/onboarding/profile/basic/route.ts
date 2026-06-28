import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { basicSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_basic");
  if (res) return res;

  const parsed = basicSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  // Сохраняем ДО перехода: если запись не легла, нельзя продвигать шаг — иначе
  // данные анкеты теряются, а пользователь уходит дальше (и застрянет на публикации).
  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // V3 MVP 2026-06-29: после basic идёт profile_birth_place (место рождения).
  // Дальше: birth_place → appearance → ... (Sprint 1 закрыл только birth_place;
  // self/family_model/partner_extended появятся в Sprint 2).
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_birth_place", profile_completion: "in_progress" },
    "anketa v3: basic saved",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_birth_place });
}
