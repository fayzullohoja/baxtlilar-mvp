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
  SMS_PROVIDER: z.enum(["mock", "eskiz", "playmobile"]).default("mock"),
  // Предохранитель запуска: при SMS_STRICT=1 запрещён провайдер mock (mock-OTP=123456
  // для всех = фиктивная верификация телефона). Выставить на проде ВМЕСТЕ с eskiz —
  // тогда забытый mock уронит старт (healthcheck не пройдёт), а не тихо пустит фейки.
  SMS_STRICT: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "1" || v === "true"),
  // Eskiz.uz (нужны только при SMS_PROVIDER=eskiz). ESKIZ_FROM — одобренный отправитель
  // (4546 — тестовый sender Eskiz). Перед прод-активацией одобрить отправителя и шаблон.
  ESKIZ_EMAIL: z.string().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  ESKIZ_FROM: z.string().default("4546"),
  ESKIZ_BASE_URL: z.string().url().default("https://notify.eskiz.uz/api"),
  APP_URL: z.string().url().optional(),
  // Канал поддержки (например, https://t.me/baxtlilar_support) — показывается на тупиковых экранах.
  SUPPORT_URL: z.string().url().optional(),
});

export type EnvShape = z.infer<typeof Env>;

/**
 * Кросс-полевой предохранитель: mock-SMS под строгим режимом запрещён.
 * Вынесен отдельной чистой функцией — чтобы юнит-тестировать без process.env.
 */
export function assertSmsConfig(e: Pick<EnvShape, "SMS_PROVIDER" | "SMS_STRICT">): void {
  if (e.SMS_STRICT && e.SMS_PROVIDER === "mock") {
    throw new Error(
      "SMS_STRICT=1 запрещает SMS_PROVIDER=mock: mock выдаёт код 123456 всем (фиктивная " +
        "верификация телефона). Задайте реальный провайдер (SMS_PROVIDER=eskiz + креды).",
    );
  }
}

let cached: EnvShape | null = null;
export function env(): EnvShape {
  if (!cached) {
    const parsed = Env.parse(process.env);
    assertSmsConfig(parsed);
    cached = parsed;
  }
  return cached;
}
