import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyInitData, InitDataError } from "@/lib/telegram/init-data";
import { setSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BootstrapBody = { initData?: string };

/**
 * POST /api/auth/bootstrap
 * Принимает Telegram WebApp initData, валидирует HMAC, апсертит пользователя по telegram_id,
 * выставляет httpOnly-сессию. В dev (DEV_BYPASS_TG=1) пропускает проверку подписи.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: BootstrapBody;
  try {
    body = (await req.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const initData = body.initData?.trim();
  if (!initData) {
    return NextResponse.json({ ok: false, error: "missing_initData" }, { status: 400 });
  }

  const e = env();
  let parsed;
  try {
    parsed = verifyInitData(initData, { bypass: e.DEV_BYPASS_TG });
  } catch (err) {
    const code = err instanceof InitDataError ? err.message : "verify_failed";
    return NextResponse.json({ ok: false, error: code }, { status: 401 });
  }

  if (!parsed.user?.id) {
    return NextResponse.json({ ok: false, error: "no_user" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const tgId = parsed.user.id;
  const tgPatch = {
    telegram_username: parsed.user.username ?? null,
    telegram_first_name: parsed.user.first_name ?? null,
    telegram_last_name: parsed.user.last_name ?? null,
  };

  // upsert по telegram_id
  const { data: existing, error: selErr } = await sb
    .from("users")
    .select("id, onboarding_step, lifecycle_state")
    .eq("telegram_id", tgId)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
  }

  let userId: string;
  let onboardingStep: string = "language";
  let lifecycleState: string = "onboarding";

  if (existing) {
    userId = existing.id;
    onboardingStep = existing.onboarding_step;
    lifecycleState = existing.lifecycle_state;
    await sb.from("users").update(tgPatch).eq("id", userId);
  } else {
    const { data: created, error: insErr } = await sb
      .from("users")
      .insert({ telegram_id: tgId, ...tgPatch })
      .select("id, onboarding_step, lifecycle_state")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { ok: false, error: insErr?.message ?? "insert_failed" },
        { status: 500 },
      );
    }
    userId = created.id;
    onboardingStep = created.onboarding_step;
    lifecycleState = created.lifecycle_state;
  }

  await setSession(userId);
  return NextResponse.json({
    ok: true,
    userId,
    onboarding_step: onboardingStep,
    lifecycle_state: lifecycleState,
  });
}
