import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { financeSchema } from "@/lib/profile/schemas";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { stampExtended } from "@/lib/profile/extended";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V4 (2026-06-30) — Чат 2 — Анкета.md Экран 9 «Финансы и материальная стабильность».
 *
 * Все 6 полей — cold (не в HOT_COLUMNS) и живут в extended.finance:
 *   income_source_stability, financial_stability_importance (1..5),
 *   family_finance_management, financial_priorities[] (1..3),
 *   monthly_income_range?, financial_obligations?.
 *
 * Экран hidden public по умолчанию — per-block видимость управляется
 * на profile_privacy (Экран 16) через extended.privacy либо глобально
 * profile_visibility_mode.
 *
 * После finance → profile_lifestyle (Экран 10).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("profile_finance");
  if (res) return res;

  const parsed = financeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "validation", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );

  const sb = supabaseAdmin();

  // Все 6 полей — cold → extended.finance. Читаем текущий extended, чтобы
  // не затереть другие секции (family, privacy, etc.).
  const { data: existing, error: readErr } = await sb
    .from("user_profiles")
    .select("extended")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr)
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  const ext = (existing?.extended as Record<string, unknown>) ?? {};
  const prevFinance = (ext.finance as Record<string, unknown>) ?? {};
  const newFinance = {
    ...prevFinance,
    income_source_stability: parsed.data.income_source_stability,
    financial_stability_importance: parsed.data.financial_stability_importance,
    family_finance_management: parsed.data.family_finance_management,
    // Ревью оунера 1.6: financial_priorities + financial_obligations больше не
    // собираются. `...prevFinance` сохраняет уже собранные значения у старых юзеров.
    ...(parsed.data.monthly_income_range
      ? { monthly_income_range: parsed.data.monthly_income_range }
      : {}),
    ...(parsed.data.housing_status
      ? { housing_status: parsed.data.housing_status }
      : {}),
  };

  const { error: saveErr } = await sb
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        extended: stampExtended({ ...ext, finance: newFinance }),
      },
      { onConflict: "user_id" },
    );
  if (saveErr)
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });

  const tr = await tryTransition(
    user.id,
    { onboarding_step: "profile_lifestyle" },
    "anketa v4: finance → lifestyle",
    { kind: "user", id: user.id },
  );
  if (!tr.ok)
    return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({
    ok: true,
    next: ONBOARDING_PATHS.profile_lifestyle,
  });
}
