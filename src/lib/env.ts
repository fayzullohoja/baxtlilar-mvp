import "server-only";
import { z } from "zod";

const Env = z.object({
  // Postgres (Railway). Внутренняя сеть Railway — без SSL; внешние хосты — PGSSL=require.
  DATABASE_URL: z.string().min(1),
  // Каталог объектного хранилища (Railway Volume в проде, локально — ./.storage).
  STORAGE_DIR: z.string().default(".storage"),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  DEV_BYPASS_TG: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "1" || v === "true"),
  // Bot-регистрация (2026-06-19 security pivot — заменили SMS-OTP на бот-flow).
  BOT_USERNAME: z.string().default("baxtlilar_uz_bot"),
  // Short name мини-аппы, настроенный в BotFather (/newapp). Формат deep-link:
  // t.me/<BOT_USERNAME>/<BOT_WEBAPP_SHORT_NAME>?startapp=<token>
  BOT_WEBAPP_SHORT_NAME: z.string().default("app"),
  // Секрет для верификации webhook'а (X-Telegram-Bot-Api-Secret-Token).
  // Передаём в setWebhook(secret_token=...). Без него любой может POST'ить в
  // /api/telegram/webhook → массовая фейк-регистрация ботом + автогенерация
  // валидных start_token'ов в обход claim_start_token (он защищает от replay,
  // не от фейк-регистрации). После round-2 verdict — REQUIRED, не optional.
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  APP_URL: z.string().url().optional(),
  // Канал поддержки (например, https://t.me/baxtlilar_support) — показывается на тупиковых экранах.
  SUPPORT_URL: z.string().url().optional(),
  // V2 Sprint 6: секрет для /api/cron/tg-outbox. Внешний cron (Railway scheduled
  // job или GitHub Actions) должен присылать X-Cron-Secret заголовок. Optional —
  // если не задан, route отдаёт 503 (не работает без секрета).
  CRON_SECRET: z.string().min(16).optional(),
});

export type EnvShape = z.infer<typeof Env>;

let cached: EnvShape | null = null;
export function env(): EnvShape {
  if (!cached) {
    cached = Env.parse(process.env);
  }
  return cached;
}
