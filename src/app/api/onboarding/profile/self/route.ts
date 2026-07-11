import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { selfSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anketa V3 Sprint 2 — Экран 3 «О себе».
 * Hot-колонки: bio (existing), education (existing), activity_field (new),
 * employment_format (new).
 *
 * V4 2026-07-01: после self → profile_family (V4 order:
 * basic → appearance → birth_place → self → family → …). До V4 route
 * ошибочно передавал в profile_appearance (legacy V2/V3), из-за чего юзеры на
 * self-шаге получали 409 tryTransition failed при сабмите: rows upsertились,
 * но переход не происходил, и клиент показывал generic «Не получилось
 * сохранить». Обнаружено live-тестом.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_self");
  if (res) return res;

  const parsed = selfSchema.safeParse(await req.json().catch(() => ({})));
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
  // Ревью оунера Экран 4: specialty + activity_field_other — COLD (extended.self),
  // read-merge-write чтобы не затирать чужие секции extended.
  const { data: prof } = await sb
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  const ext = (prof?.extended as Record<string, unknown>) ?? {};
  const selfSection = (ext.self as Record<string, unknown>) ?? {};
  const newExtended = {
    ...ext,
    self: {
      ...selfSection,
      ...(parsed.data.specialty ? { specialty: parsed.data.specialty } : {}),
      ...(parsed.data.activity_field_other
        ? { activity_field_other: parsed.data.activity_field_other }
        : {}),
    },
  };

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        bio: parsed.data.bio,
        education: parsed.data.education,
        activity_field: parsed.data.activity_field,
        employment_status: parsed.data.employment_status,
        employment_format: parsed.data.employment_format ?? null,
        extended: newExtended,
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_family" },
    "anketa v4: self → family",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.profile_family });
}
