import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Публикация анкеты (проверено≠опубликовано: публикует сам пользователь) → к опросу. */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_preview");
  if (res) return res;
  const sb = supabaseAdmin();

  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, gender, birth_date, country_of_residence, region, bio, religion, top_life_values, partner_age_min, partner_age_max")
    .eq("user_id", user.id)
    .maybeSingle();
  // V3 (2026-06-30, Bug #5): region обязателен только для UZ-резидентов
  // (basicSchema.ts:104-114 ставит требование conditionally). Для non-UZ
  // юзеров region валидно null, и проверять его truthy здесь — это permanent
  // блок публикации.
  const regionOk = p && (p.country_of_residence !== "UZ" || !!p.region);
  const complete =
    p &&
    p.display_name &&
    p.gender &&
    p.birth_date &&
    regionOk &&
    p.bio &&
    p.religion &&
    Array.isArray(p.top_life_values) &&
    p.top_life_values.length >= 1 &&
    p.partner_age_min &&
    p.partner_age_max;
  if (!complete)
    return NextResponse.json({ ok: false, error: "profile_incomplete" }, { status: 400 });

  // нужно ≥1 НЕ отклонённого фото (approved/under_review), иначе анкета останется без видимого фото
  const { count, error: cntErr } = await sb
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "rejected");
  // сбой БД (500) ≠ «реально нет фото» (400): не блокируем публикацию ложным no_photo
  if (cntErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  if (!count) return NextResponse.json({ ok: false, error: "no_photo" }, { status: 400 });

  // Публикация — намеренное действие пользователя: если update не прошёл, нельзя
  // отвечать «ok» и уводить на опрос — анкета осталась бы неопубликованной (невидимой).
  const { error: pubErr } = await sb
    .from("user_profiles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (pubErr) return NextResponse.json({ ok: false, error: "publish_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "quiz", profile_completion: "completed" },
    "profile published",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.quiz });
}
