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
 * V4 2026-07-01: правильная транзиция profile_appearance → profile_birth_place
 * (после swap #4 в V4 flow). Раньше route уводил в profile_family, а между ними
 * находятся profile_birth_place и profile_self — tryTransition возвращал 409 и
 * весь V4 flow ломался на первом же шаге после basic. Найдено live-audit'ом
 * workflow #w8e85hl6n. Вес — optional (anti drop-off).
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

  const sb = supabaseAdmin();
  // Ревью оунера Экран 2: other_language (свободный ввод «Другой») — COLD, extended.langs.
  const { data: prof } = await sb
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ext = (prof?.extended as Record<string, unknown>) ?? {};
  const langsSection = (ext.langs as Record<string, unknown>) ?? {};
  const newExtended = parsed.data.other_language
    ? { ...ext, langs: { ...langsSection, other_language: parsed.data.other_language } }
    : ext;

  // Сохраняем ДО transition: если save упал — не двигаем шаг, иначе данные потеряны.
  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        height_cm: parsed.data.height_cm ?? null,
        weight_kg: parsed.data.weight_kg ?? null,
        native_language: parsed.data.native_language,
        languages: parsed.data.languages,
        extended: newExtended,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_birth_place" },
    "anketa v4: appearance → birth-place",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_birth_place });
}
