import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/telegram/webhook
// Telegram постит Update'ы сюда. Защита: secret_token, заданный в setWebhook,
// приходит в заголовке X-Telegram-Bot-Api-Secret-Token. Без него любой может
// постить фейковые updates → массовая регистрация ботом.
// Ответ всегда 200 (даже на ошибку), чтобы TG не повторял доставку — обработка
// best-effort, ошибки логируем.
export async function POST(req: NextRequest): Promise<NextResponse> {
  // env.ts требует TELEGRAM_WEBHOOK_SECRET (z.string().min(16)) — без него
  // приложение не стартует (fail-closed на boot). Здесь — обычная проверка
  // заголовка против ожидаемого секрета. Раньше был `if (expected)` который
  // позволял fail-open при missing env — round-2 completeness flagged.
  const expected = env().TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (got !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("[webhook] handler error:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
