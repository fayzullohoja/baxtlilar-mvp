import "server-only";
import { env } from "@/lib/env";
import { sendViaEskiz } from "./eskiz";

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
  // НЕ fail-open: неподключённый провайдер должен бросать, иначе верификация телефона
  // «успешно» проходит в проде без реальной отправки кода.
  if (provider === "eskiz") {
    const e = env();
    if (!e.ESKIZ_EMAIL || !e.ESKIZ_PASSWORD)
      throw new Error("SMS provider 'eskiz' selected but ESKIZ_EMAIL/ESKIZ_PASSWORD not set");
    await sendViaEskiz(
      { baseUrl: e.ESKIZ_BASE_URL, email: e.ESKIZ_EMAIL, password: e.ESKIZ_PASSWORD, from: e.ESKIZ_FROM },
      phone,
      text,
    );
    return;
  }
  if (provider === "playmobile") {
    throw new Error("SMS provider 'playmobile' is not configured");
  }
  throw new Error(`Unknown SMS provider: ${provider}`);
}

/** В dev/mock режиме фиксированный код всегда валиден. */
export function devFixedOtp(): string | null {
  return env().SMS_PROVIDER === "mock" ? "123456" : null;
}
