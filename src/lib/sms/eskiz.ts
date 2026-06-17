import "server-only";

/**
 * Клиент Eskiz.uz — доминирующий SMS-провайдер в Узбекистане.
 * REST (notify.eskiz.uz/api):
 *   POST /auth/login   (form: email,password)        → { data: { token } }  (Bearer, ~30 дней)
 *   POST /message/sms/send (Bearer; form: mobile_phone,message,from) → { id, status, message }
 *
 * Активируется через SMS_PROVIDER=eskiz + ESKIZ_EMAIL/ESKIZ_PASSWORD (см. env.ts).
 * Конфиг ПЕРЕДАЁТСЯ аргументом (а не читается из env) — модуль чист и тестируем.
 *
 * ⚠️ Перед прод-активацией: одобрить отправителя (ESKIZ_FROM) и текст-шаблон OTP в
 *    кабинете Eskiz, иначе провайдер отклонит отправку. Сделать реальный smoke-тест.
 */

export type EskizConfig = { baseUrl: string; email: string; password: string; from: string };

// Кэш токена в памяти процесса. TTL с запасом меньше реального (~30 дней).
let tokenCache: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;

async function login(cfg: EskizConfig): Promise<string> {
  const form = new FormData();
  form.append("email", cfg.email);
  form.append("password", cfg.password);
  const res = await fetch(`${cfg.baseUrl}/auth/login`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Eskiz login failed: HTTP ${res.status}`);
  const data = (await res.json()) as { data?: { token?: string } };
  const token = data?.data?.token;
  if (!token) throw new Error("Eskiz login: no token in response");
  return token;
}

async function getToken(cfg: EskizConfig, force = false): Promise<string> {
  if (!force && tokenCache && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;
  const token = await login(cfg);
  tokenCache = { token, at: Date.now() };
  return token;
}

/** Eskiz ждёт номер только из цифр в формате 998XXXXXXXXX (без «+»). */
function toEskizPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function sendViaEskiz(cfg: EskizConfig, phone: string, text: string): Promise<void> {
  const mobile_phone = toEskizPhone(phone);
  const doSend = async (token: string): Promise<Response> => {
    const form = new FormData();
    form.append("mobile_phone", mobile_phone);
    form.append("message", text);
    form.append("from", cfg.from);
    return fetch(`${cfg.baseUrl}/message/sms/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };

  let res = await doSend(await getToken(cfg));
  // токен протух → один повтор со свежим токеном
  if (res.status === 401) res = await doSend(await getToken(cfg, true));

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Eskiz send failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
}

/** Только для тестов: сбросить кэш токена. */
export function __resetEskizTokenCache(): void {
  tokenCache = null;
}
