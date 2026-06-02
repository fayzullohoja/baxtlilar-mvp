import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";

const TTL_SEC = 5 * 60; // 5 минут
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60; // 1/мин
const MAX_PER_HOUR = 5;

function hashCode(code: string): string {
  return crypto.createHmac("sha256", env().SESSION_SECRET).update(code).digest("hex");
}

function genCode(): string {
  // 6 цифр; в mock-режиме фиксированный 123456 для удобства тестов
  if (env().SMS_PROVIDER === "mock") return "123456";
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export type SendResult = { ok: true } | { ok: false; error: "cooldown" | "hourly_limit" | "sms_failed" };

export async function sendOtp(userId: string, phone: string): Promise<SendResult> {
  const sb = supabaseAdmin();
  const nowMs = Date.now();

  const { data: recent } = await sb
    .from("otp_codes")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_HOUR);

  if (recent && recent.length) {
    const lastMs = new Date(recent[0].created_at as string).getTime();
    if (nowMs - lastMs < RESEND_COOLDOWN_SEC * 1000) return { ok: false, error: "cooldown" };
    const hourAgo = nowMs - 3600_000;
    const inHour = recent.filter((r) => new Date(r.created_at as string).getTime() > hourAgo);
    if (inHour.length >= MAX_PER_HOUR) return { ok: false, error: "hourly_limit" };
  }

  // M6: антибомбинг по НОМЕРУ (а не только по user_id) — иначе один номер можно засыпать SMS
  // через разные аккаунты. Те же окна: cooldown + лимит/час.
  const { data: byPhone } = await sb
    .from("otp_codes")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_HOUR);
  if (byPhone && byPhone.length) {
    const lastMs = new Date(byPhone[0].created_at as string).getTime();
    if (nowMs - lastMs < RESEND_COOLDOWN_SEC * 1000) return { ok: false, error: "cooldown" };
    const hourAgo = nowMs - 3600_000;
    const inHour = byPhone.filter((r) => new Date(r.created_at as string).getTime() > hourAgo);
    if (inHour.length >= MAX_PER_HOUR) return { ok: false, error: "hourly_limit" };
  }

  // ONB-1/BUG-9: гасим все прежние неиспользованные коды — валиден только новый.
  await sb
    .from("otp_codes")
    .update({ used_at: new Date(nowMs).toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  const code = genCode();
  const expiresAt = new Date(nowMs + TTL_SEC * 1000).toISOString();
  await sb.from("otp_codes").insert({
    user_id: userId,
    phone,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });
  try {
    await sendSms(phone, `Baxtlilar: ваш код подтверждения ${code}`);
  } catch (e) {
    // провайдер не настроен/недоступен — НЕ выдаём «успех», иначе пользователь застрянет без кода
    console.error("[sendOtp] SMS send failed:", e);
    return { ok: false, error: "sms_failed" };
  }
  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: "no_code" | "expired" | "too_many_attempts" | "wrong_code" };

export async function verifyOtp(userId: string, code: string): Promise<VerifyResult> {
  const sb = supabaseAdmin();
  const { data: rows } = await sb
    .from("otp_codes")
    .select("*")
    .eq("user_id", userId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const otp = rows?.[0];
  if (!otp) return { ok: false, error: "no_code" };
  if (new Date(otp.expires_at as string).getTime() < Date.now())
    return { ok: false, error: "expired" };
  if ((otp.attempts as number) >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  if (hashCode(code) !== otp.code_hash) {
    // M5: атомарный инкремент попыток (без lost-update при гонке неверных кодов)
    const { data: attempts, error } = await sb.rpc("bump_otp_attempt", { p_id: otp.id as string });
    // fail-closed: если счётчик не увеличился (ошибка/не число) — не раздаём новые попытки
    if (error || typeof attempts !== "number" || attempts >= MAX_ATTEMPTS)
      return { ok: false, error: "too_many_attempts" };
    return { ok: false, error: "wrong_code" };
  }

  await sb.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", otp.id as string);
  return { ok: true };
}
