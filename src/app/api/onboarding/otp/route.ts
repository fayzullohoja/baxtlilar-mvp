import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyOtp, sendOtp } from "@/lib/otp/service";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Подтверждение OTP: проверка кода → phone_verified + verification_status=phone_verified,
 * otp_pending → doc_upload. Поддерживает action:"resend" для повторной отправки.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("otp_pending");
  if (res) return res;

  const body = (await req.json().catch(() => ({}))) as { code?: string; action?: string };

  if (body.action === "resend") {
    if (!user.phone_number)
      return NextResponse.json({ ok: false, error: "no_phone" }, { status: 400 });
    const r = await sendOtp(user.id, user.phone_number);
    return r.ok
      ? NextResponse.json({ ok: true, resent: true })
      : NextResponse.json({ ok: false, error: r.error }, { status: 429 });
  }

  const code = (body.code ?? "").trim();
  if (!/^\d{4,6}$/.test(code))
    return NextResponse.json({ ok: false, error: "bad_code_format" }, { status: 400 });

  const v = await verifyOtp(user.id, code);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  // ONB-2: повторная проверка занятости номера перед подтверждением (защита от гонки;
  // на уровне БД дополнительно стоит partial-unique индекс phone при phone_verified=true).
  if (user.phone_number) {
    const { data: taken } = await supabaseAdmin()
      .from("users")
      .select("id")
      .eq("phone_number", user.phone_number)
      .eq("phone_verified", true)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) return NextResponse.json({ ok: false, error: "phone_taken" }, { status: 409 });
  }

  await supabaseAdmin()
    .from("users")
    .update({ phone_verified_at: new Date().toISOString() })
    .eq("id", user.id);

  const tr = await tryTransition(
    user.id,
    { phone_verified: true, verification_status: "phone_verified", onboarding_step: "doc_upload" },
    "otp verified",
    { kind: "user", id: user.id },
  );
  if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.doc_upload });
}
