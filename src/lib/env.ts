import "server-only";
import { z } from "zod";

const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
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
