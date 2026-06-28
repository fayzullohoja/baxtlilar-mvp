import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appearanceSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V2 ext 2026-06-28: новый шаг анкеты — рост / вес / родной язык / владею.
 * Между profile_basic и profile_family. Вес — optional (anti drop-off).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_appearance");
  if (res) return res;

  const parsed = appearanceSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        error: "validation",
        detail: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );

  // Сохраняем ДО transition: если save упал — не двигаем шаг, иначе данные потеряны.
  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        height_cm: parsed.data.height_cm,
        weight_kg: parsed.data.weight_kg ?? null,
        native_language: parsed.data.native_language,
        languages: parsed.data.languages,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_family" },
    "anketa: appearance saved",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_family });
}
