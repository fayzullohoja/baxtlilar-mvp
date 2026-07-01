import "server-only";
import { env } from "@/lib/env";

// Тонкий клиент Telegram Bot API. Используется ботом-вебхуком (/api/telegram/webhook).
// `fetch` с таймаутом 10с (Eskiz-урок: висящий fetch на upstream съедает функцию).
// Ошибки не бросаются — best-effort, логируем.

const API_BASE = "https://api.telegram.org";

export type ReplyKeyboardButton = { text: string; request_contact?: boolean };
export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
};

export type ReplyKeyboardMarkup = {
  keyboard: ReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type ReplyMarkup =
  | ReplyKeyboardMarkup
  | InlineKeyboardMarkup
  | { remove_keyboard: true }
  | undefined;

async function call(method: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/bot${env().TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[bot-api] ${method} HTTP ${res.status}: ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[bot-api] ${method} failed:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

export function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup,
  parseMode?: "HTML" | "MarkdownV2",
): Promise<boolean> {
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  // По дефолту без parse_mode: plain текст, никакой HTML/MD-инъекции.
  // parseMode = "HTML" — только для подписанных нами сообщений (legal links).
  // Контент-источник: bot/messages.ts константы, не user input.
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return call("sendMessage", payload);
}

export function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
  const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) payload.text = text;
  return call("answerCallbackQuery", payload);
}

export function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return call("editMessageReplyMarkup", payload);
}

/**
 * sendDocument — отправить файл-вложение. Используется для legal PDF
 * (оферта, политика, правила, согласие на ПД) перед запросом согласия.
 *
 * `document` принимает либо публичный URL (Telegram сам скачает и закеширует
 * по file_id со 2-го раза), либо ранее сохранённый file_id. Мы передаём URL —
 * `${APP_URL}/legal/<slug>.pdf` (файлы в /public/legal/).
 *
 * Caption опционально показывается под файлом (макс 1024 симв).
 */
export function sendDocument(
  chatId: number,
  documentUrl: string,
  caption?: string,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    document: documentUrl,
  };
  if (caption) payload.caption = caption;
  return call("sendDocument", payload);
}
