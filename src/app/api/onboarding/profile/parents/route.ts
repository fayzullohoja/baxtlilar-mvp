import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parentsSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { stampExtended } from "@/lib/profile/extended";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Экран 6 «Родители и участие семьи» (2026-07-12) — между family и values.
 *
 * Всё COLD → extended.parents (read-merge-write, не затираем чужие секции).
 * Никаких hot-колонок. Обязательны только father_status / mother_status /
 * family_involvement (схема); детали опциональны (не форсим «досье на родителей»).
 *
 * Privacy: данные скрыты по умолчанию — их не читает ни одна pre/post-mutual
 * поверхность (progressive-view — whitelist без extended). Дефолты видимости
 * пишем метаданными в extended.parents._visibility под будущий granular-контроль
 * (сам энфорсмент отложен, как и per-block privacy в целом).
 */
const VISIBILITY_DEFAULTS: Record<string, "matching_only" | "hidden"> = {
  father_status: "matching_only",
  mother_status: "matching_only",
  father_age_range: "hidden",
  mother_age_range: "hidden",
  father_profession: "matching_only",
  mother_profession: "matching_only",
  father_origin_region: "matching_only",
  mother_origin_region: "matching_only",
  father_current_location: "hidden",
  mother_current_location: "hidden",
  family_involvement: "matching_only",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_parents");
  if (res) return res;

  const parsed = parentsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();
  const { data: prof } = await sb
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ext = (prof?.extended as Record<string, unknown>) ?? {};
  const prevParents = (ext.parents as Record<string, unknown>) ?? {};

  // IF/THEN оунера: «хочу советоваться с семьёй» → позже мягко предложить
  // семейный аддон (флаг для будущей фичи, самой фичи ещё нет).
  const later_offer_family_addon =
    parsed.data.family_involvement === "family_consultation";

  const newExtended = {
    ...ext,
    parents: {
      ...prevParents,
      ...parsed.data,
      _visibility: VISIBILITY_DEFAULTS,
      later_offer_family_addon,
    },
  };

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert({ user_id: user.id, extended: stampExtended(newExtended) }, { onConflict: "user_id" });
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_values" },
    "anketa: parents → values",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_values });
}
