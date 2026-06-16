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
  APP_URL: z.string().url().optional(),
  // Канал поддержки (например, https://t.me/baxtlilar_support) — показывается на тупиковых экранах.
  SUPPORT_URL: z.string().url().optional(),
});

export type EnvShape = z.infer<typeof Env>;

let cached: EnvShape | null = null;
export function env(): EnvShape {
  if (!cached) cached = Env.parse(process.env);
  return cached;
}
