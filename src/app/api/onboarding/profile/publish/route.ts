import { NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { verifiedGenderMatches } from "@/lib/onboarding/verified-gender";
import { MARITAL_STATUS_NEEDS_REVIEW } from "@/lib/profile/options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Публикация анкеты (проверено≠опубликовано: публикует сам пользователь) → к опросу. */
export async function POST(): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_preview");
  if (res) return res;
  const sb = supabaseAdmin();

  const { data: p } = await sb
    .from("user_profiles")
    .select("display_name, gender, birth_date, country_of_residence, region, bio, religion, top_life_values, partner_age_min, partner_age_max, marital_status")
    .eq("user_id", user.id)
    .maybeSingle();
  // V3 (2026-06-30, Bug #5): region обязателен только для UZ-резидентов
  // (basicSchema.ts:104-114 ставит требование conditionally). Для non-UZ
  // юзеров region валидно null, и проверять его truthy здесь — это permanent
  // блок публикации.
  const regionOk = p && (p.country_of_residence !== "UZ" || !!p.region);
  // 2026-07-12: religion стал ОПЦИОНАЛЬНЫМ в анкете (owner: «вера/доход
  // опциональны», убран «не хочу указывать»). Раньше publish требовал
  // p.religion → юзер, не указавший веру (теперь легальный выбор), навсегда
  // застревал на profile_preview с profile_incomplete (dead-end). Убираем.
  const complete =
    p &&
    p.display_name &&
    p.gender &&
    p.birth_date &&
    regionOk &&
    p.bio &&
    Array.isArray(p.top_life_values) &&
    p.top_life_values.length >= 1 &&
    p.partner_age_min &&
    p.partner_age_max;
  if (!complete)
    return NextResponse.json({ ok: false, error: "profile_incomplete" }, { status: 400 });

  // C6: анкетный пол должен совпадать с верифицированным паспортным
  // (user_identity.gender, введён модератором при approve). Без этого
  // верифицированный юзер мог бы выйти в матчинг под противоположным полом —
  // обход взаимного пола / catfishing. Берём активную (не superseded) identity;
  // если её нет (нештатно для approved) — verifiedGenderMatches вернёт true и
  // публикацию не блокируем.
  const { data: idRow } = await sb
    .from("user_identity")
    .select("gender")
    .eq("user_id", user.id)
    .is("superseded_at", null)
    .maybeSingle();
  if (!verifiedGenderMatches(p.gender as string, idRow?.gender as string | null | undefined))
    return NextResponse.json({ ok: false, error: "gender_mismatch" }, { status: 409 });

  // нужно ≥1 НЕ отклонённого НЕ-family фото (approved/under_review): family видно
  // только post-mutual и исключено из get_recommendations, поэтому без portrait/full_body
  // анкета осталась бы без видимого в ленте фото.
  const { count, error: cntErr } = await sb
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "rejected")
    .neq("photo_type", "family");
  // сбой БД (500) ≠ «реально нет фото» (400): не блокируем публикацию ложным no_photo
  if (cntErr) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  if (!count) return NextResponse.json({ ok: false, error: "no_photo" }, { status: 400 });

  // F4 (ревью оунера): «чувствительное» семейное положение (в разводе / в браке,
  // но раздельно) поднимаем на операторское контент-ревью. Флаг не гейтит
  // видимость — анкета публикуется обычным образом, просто попадает в дашборд.
  const needsMaritalReview = (
    MARITAL_STATUS_NEEDS_REVIEW as readonly string[]
  ).includes(p.marital_status as string);

  // Публикация — намеренное действие пользователя: если update не прошёл, нельзя
  // отвечать «ok» и уводить на опрос — анкета осталась бы неопубликованной (невидимой).
  const { error: pubErr } = await sb
    .from("user_profiles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      needs_marital_review: needsMaritalReview,
    })
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
