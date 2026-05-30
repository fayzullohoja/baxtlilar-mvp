import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type ParsedInitData = {
  user?: TelegramUser;
  auth_date: number;
  query_id?: string;
  raw: Record<string, string>;
};

export class InitDataError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InitDataError";
  }
}

/**
 * Проверка Telegram WebApp initData по HMAC-SHA256 (см. https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * @param initDataRaw сырая строка `window.Telegram.WebApp.initData`.
 * @param opts.maxAgeSec — максимум возраста (по умолч. 24ч).
 * @param opts.bypass — true в dev (`DEV_BYPASS_TG=1`) пропускает проверку подписи.
 */
export function verifyInitData(
  initDataRaw: string,
  opts?: { maxAgeSec?: number; bypass?: boolean },
): ParsedInitData {
  if (!initDataRaw) throw new InitDataError("empty initData");

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) throw new InitDataError("missing hash");
  params.delete("hash");

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const e = env();
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(e.TELEGRAM_BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!opts?.bypass && computed !== hash) throw new InitDataError("hash mismatch");

  const raw = Object.fromEntries(entries);
  const auth_date = Number.parseInt(raw.auth_date ?? "0", 10);
  if (!auth_date) throw new InitDataError("missing auth_date");

  const ageSec = Math.floor(Date.now() / 1000) - auth_date;
  const maxAge = opts?.maxAgeSec ?? 86400;
  if (!opts?.bypass && ageSec > maxAge) throw new InitDataError("initData expired");

  let user: TelegramUser | undefined;
  if (raw.user) {
    try {
      user = JSON.parse(raw.user) as TelegramUser;
    } catch {
      throw new InitDataError("invalid user JSON");
    }
  }

  return { user, auth_date, query_id: raw.query_id, raw };
}
