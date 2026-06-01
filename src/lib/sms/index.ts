import "server-only";
import { env } from "@/lib/env";

/**
 * Отправка SMS. MVP: провайдер `mock` (логирует, не шлёт; код 123456 принимается).
 * Eskiz/PlayMobile — заглушки до подключения (OD-3).
 */
export async function sendSms(phone: string, text: string): Promise<void> {
  const provider = env().SMS_PROVIDER;
  if (provider === "mock") {
    console.log(`[SMS:mock] → ${phone}: ${text}`);
    return;
  }
  if (provider === "eskiz") {
    // TODO(OD-3): Eskiz.uz REST — получить токен, POST /message/sms/send
    console.warn("[SMS:eskiz] not configured yet — falling back to no-op");
    return;
  }
  if (provider === "playmobile") {
    console.warn("[SMS:playmobile] not configured yet — falling back to no-op");
    return;
  }
}

/** В dev/mock режиме фиксированный код всегда валиден. */
export function devFixedOtp(): string | null {
  return env().SMS_PROVIDER === "mock" ? "123456" : null;
}
