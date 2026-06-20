import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyInitData, InitDataError } from "@/lib/telegram/init-data";
import { verifyStartToken } from "@/lib/telegram/start-token";
import { setSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BootstrapBody = { initData?: string; start_param?: string | null };

// Шаги, на которых пользователь ЕЩЁ В БОТЕ и не имеет права получить сессию
// мини-аппы. Бот сам ведёт через них; мини-аппа открывается только после
// bot_consent_biometric → doc_upload.
const BOT_OR_LEGACY_STEPS = new Set<string>([
  "bot_language",
  "bot_contact",
  "bot_consent_pd",
  "bot_consent_biometric",
  // Legacy SMS-шаги (бывшие до 2026-06-19 pivot) — тоже не пускаем без перерегистрации в боте.
  "language",
  "consent",
  "phone_input",
  "otp_pending",
]);

/**
 * POST /api/auth/bootstrap
 *
 * Обмен Telegram initData (+ опционально start_param) на сессионный cookie.
 *
 * После security-pivot 2026-06-19: пользователь ДОЛЖЕН быть предварительно
 * зарегистрирован у бота. Если строки в users нет, либо она ещё на bot_*-шаге —
 * возвращаем 403 register_required (фронт показывает кнопку deep-link на бота).
 *
 * start_param (если есть) — это HMAC-подписанный токен, который бот вшил в
 * deep-link мини-аппы; защита от того, что чужой initData от случайного
 * TG-пользователя кому-то даст вход без регистрации.
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
    const bypass = e.DEV_BYPASS_TG && process.env.NODE_ENV !== "production";
    parsed = verifyInitData(initData, { bypass, maxAgeSec: 3 * 3600 });
  } catch (err) {
    const code = err instanceof InitDataError ? err.message : "verify_failed";
    return NextResponse.json({ ok: false, error: code }, { status: 401 });
  }

  if (!parsed.user?.id) {
    return NextResponse.json({ ok: false, error: "no_user" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const tgId = parsed.user.id;

  const { data: row, error: selErr } = await sb
    .from("users")
    .select("id, onboarding_step, lifecycle_state")
    .eq("telegram_id", tgId)
    .maybeSingle();
  if (selErr) {
    console.error("[bootstrap] select failed:", selErr.message);
    return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "register_required" }, { status: 403 });
  }

  // start_param (если был) — связываем uid с найденным user.id.
  // H3 verdict-fix: токен биндится к telegram_id юзера. Если v.tg ≠ initData
  // user.id — украденный токен в чужой initData отвергаем (catfish A открыл
  // мини-аппу под initData пользователя B со своим валидным token).
  if (body.start_param) {
    const v = verifyStartToken(body.start_param);
    if (!v || v.uid !== row.id || v.tg !== tgId) {
      return NextResponse.json({ ok: false, error: "bad_start_param" }, { status: 401 });
    }
  }

  // Гейт: пользователь должен быть ПОСЛЕ бот-flow.
  if (BOT_OR_LEGACY_STEPS.has(row.onboarding_step)) {
    return NextResponse.json({ ok: false, error: "register_required" }, { status: 403 });
  }

  // Тонкий метаобновлятор tg-полей (имя/username могло смениться).
  await sb
    .from("users")
    .update({
      telegram_username: parsed.user.username ?? null,
      telegram_first_name: parsed.user.first_name ?? null,
      telegram_last_name: parsed.user.last_name ?? null,
    })
    .eq("id", row.id);

  await setSession(row.id as string);
  return NextResponse.json({
    ok: true,
    userId: row.id,
    onboarding_step: row.onboarding_step,
    lifecycle_state: row.lifecycle_state,
  });
}
