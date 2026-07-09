import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { basicSchema, splitHotCold } from "@/lib/profile/schemas";
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
  //
  // V4 2026-06-30 — Чат 2 — Анкета: district + district_visible_public добавлены
  // как HOT колонки (schemas.HOT_COLUMNS). Явно проходим через splitHotCold,
  // чтобы новые/будущие cold-поля basic не легли ошибкой в колонки user_profiles.
  const { hot, cold } = splitHotCold(parsed.data as Record<string, unknown>);
  const hotUpdate: Record<string, unknown> = { user_id: user.id, ...hot };

  // Cold сегодня пуст (все поля basic — hot). Оставлено на будущее.
  if (Object.keys(cold).length > 0) {
    const { data: existing, error: readErr } = await supabaseAdmin()
      .from("user_profiles")
      .select("extended")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readErr)
      return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
    const ext = (existing?.extended as Record<string, unknown>) ?? {};
    hotUpdate.extended = { ...ext, ...cold };
  }

  const { error: saveErr } = await supabaseAdmin()
    .from("user_profiles")
    .upsert(hotUpdate, { onConflict: "user_id" });
  if (saveErr) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // V4 2026-07-01: swap appearance ↔ birth-place. Новый порядок:
  // basic → appearance → birth_place → self → family → …
  // До V4 route уводил в birth_place, что нарушало учредительскую поправку №4.
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_appearance", profile_completion: "in_progress" },
    "anketa v4: basic → appearance",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_appearance });
}
