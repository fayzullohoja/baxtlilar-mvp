import { NextRequest, NextResponse } from "next/server";
import { clearFilterSkips } from "@/lib/matching/clear-filter-skips";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { partnerExtendedSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { stampExtended } from "@/lib/profile/extended";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 Sprint 2 — Экран 8 «Ожидания от партнёра» (расширенный).
 *
 * Поля:
 * - partner_age_min/max (required)
 * - partner_height_min/max (optional)
 * - partner_top_qualities[] (required, 1-5)
 * - partner_religion_match (optional) — миграция per founder #10 (section purity).
 * - partner_preferred_countries[] (optional, soft filter, max 3) — founder #13.
 *
 * Пол партнёра выводится автоматически как противоположный своему
 * (как и в legacy looking_for).
 *
 * 2026-07-12 (ревью оунера): экран privacy убран из потока —
 * partner_extended ведёт СРАЗУ на profile_photos. Видимость остаётся
 * дефолтом 'verified_only'; шаг privacy — legacy pass-through.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_partner_extended");
  if (res) return res;

  const parsed = partnerExtendedSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();

  // Авто-вывод looking_for_gender + читаем extended (не затираем чужие секции).
  const { data: prof } = await sb
    .from("user_profiles")
    .select("gender, extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ownGender = prof?.gender as string | undefined;
  if (ownGender !== "m" && ownGender !== "f")
    return NextResponse.json({ ok: false, error: "no_gender" }, { status: 409 });
  const looking_for_gender = ownGender === "m" ? "f" : "m";

  // Ревью оунера Экран 12: доп. ожидания к партнёру — COLD, в extended.partner
  // (тот же read-merge-write паттерн, что у lifestyle/finance — не hot-колонки).
  const ext = (prof?.extended as Record<string, unknown>) ?? {};
  const partnerSection = (ext.partner as Record<string, unknown>) ?? {};
  const newExtended = {
    ...ext,
    partner: {
      ...partnerSection,
      // Ревью оунера 1.13/1.14: вес + национальность партнёра — COLD, soft (в
      // matching НЕ энфорсятся). Вес держим cold (в отличие от hot-роста) — без миграции.
      // Пишем БЕЗУСЛОВНО (null при сбросе, как hot-рост) — иначе `...partnerSection`
      // сохранил бы старое значение и очистка ползунка не сработала бы (adversarial-ревью).
      partner_weight_min: parsed.data.partner_weight_min ?? null,
      partner_weight_max: parsed.data.partner_weight_max ?? null,
      ...(parsed.data.partner_nationality_pref
        ? { partner_nationality_pref: parsed.data.partner_nationality_pref }
        : {}),
      ...(parsed.data.partner_nationality?.length
        ? { partner_nationality: parsed.data.partner_nationality }
        : {}),
      // §13 п.6: отношение к здоровью партнёра (общий набор HEALTH_OPENNESS), COLD.
      ...(parsed.data.partner_health_attitude
        ? { partner_health_attitude: parsed.data.partner_health_attitude }
        : {}),
      ...(parsed.data.partner_marital_pref?.length
        ? { partner_marital_pref: parsed.data.partner_marital_pref }
        : {}),
      ...(parsed.data.partner_children_pref
        ? { partner_children_pref: parsed.data.partner_children_pref }
        : {}),
      ...(parsed.data.partner_origin_region_pref
        ? { partner_origin_region_pref: parsed.data.partner_origin_region_pref }
        : {}),
      ...(parsed.data.partner_hard_criteria?.length
        ? { partner_hard_criteria: parsed.data.partner_hard_criteria }
        : {}),
    },
  };

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        partner_age_min: parsed.data.partner_age_min,
        partner_age_max: parsed.data.partner_age_max,
        partner_height_min: parsed.data.partner_height_min ?? null,
        partner_height_max: parsed.data.partner_height_max ?? null,
        partner_top_qualities: parsed.data.partner_top_qualities,
        partner_religion_match: parsed.data.partner_religion_match ?? null,
        partner_preferred_countries: parsed.data.partner_preferred_countries ?? null,
        looking_for_gender,
        // V2-compat: legacy geo_preference дефолт
        geo_preference: "my_city",
        extended: stampExtended(newExtended),
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  // Человек поменял возрастные рамки - значит отказы вида «не подходит по
  // возрасту» больше не имеют оснований, и спрятанных за них людей надо
  // вернуть. Иначе выходит ловушка: рамки починил, а лента осталась пустой.
  // Этот шаг доступен и после онбординга (настройки редиректят в повторный
  // проход анкеты), так что вызов не мёртвый. Гео здесь всегда 'my_city' и не
  // меняется, поэтому снимаем только возрастные.
  await clearFilterSkips(user.id, ["age"]);

  // 2026-07-12 (ревью оунера): экран приватности убран — анкета видна только
  // при мэтчинге (profile_visibility_mode остаётся дефолтом 'verified_only').
  // partner_extended → photos напрямую (шаг privacy пропущен для новых юзеров).
  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_photos" },
    "anketa: partner-extended → photos (privacy skipped)",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_photos });
}
