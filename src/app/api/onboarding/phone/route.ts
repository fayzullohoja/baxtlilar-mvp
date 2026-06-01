import { NextRequest, NextResponse } from "next/server";
import { loadUserForStep } from "@/lib/onboarding/guard-api";
import { transition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeUzPhone, PhoneError } from "@/lib/phone";
import { sendOtp } from "@/lib/otp/service";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ввод телефона: нормализация, проверка занятости, отправка OTP, phone_input → otp_pending. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadUserForStep("phone_input");
  if (res) return res;

  let phone: string;
  try {
    const body = (await req.json()) as { phone?: string };
    phone = normalizeUzPhone(body.phone ?? "");
  } catch (e) {
    const err = e instanceof PhoneError ? e.message : "invalid_phone";
    return NextResponse.json({ ok: false, error: "invalid_phone", detail: err }, { status: 400 });
  }

  // номер уже привязан к другому подтверждённому аккаунту?
  const { data: taken } = await supabaseAdmin()
    .from("users")
    .select("id")
    .eq("phone_number", phone)
    .eq("phone_verified", true)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) return NextResponse.json({ ok: false, error: "phone_taken" }, { status: 409 });

  const sent = await sendOtp(user.id, phone);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error }, { status: 429 });

  await transition(
    user.id,
    { phone_number: phone, onboarding_step: "otp_pending" },
    "phone submitted, OTP sent",
    { kind: "user", id: user.id },
  );
  return NextResponse.json({ ok: true, next: ONBOARDING_PATHS.otp_pending });
}
