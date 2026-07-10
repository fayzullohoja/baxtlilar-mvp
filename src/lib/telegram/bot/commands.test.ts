import { describe, it, expect, vi, beforeEach } from "vitest";
import { M } from "./messages";

// --- Мокаем внешние зависимости хендлеров ---------------------------------

// Захватываем исходящие сообщения бота.
const sent: Array<{ chatId: number; text: string; markup?: unknown; parseMode?: string }> = [];
vi.mock("../bot-api", () => ({
  sendMessage: vi.fn((chatId: number, text: string, markup?: unknown, parseMode?: string) => {
    sent.push({ chatId, text, markup, parseMode });
    return Promise.resolve(true);
  }),
  answerCallbackQuery: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/env", () => ({
  env: () => ({
    APP_URL: "https://app.example",
    SUPPORT_URL: "https://t.me/baxtlilar_support",
    SESSION_SECRET: "0123456789012345678901234567890123456789",
    TELEGRAM_BOT_TOKEN: "test-token-0000000000",
  }),
}));

// Текущий юзер, который вернёт findByTg; тесты его подменяют.
let currentUser: Record<string, unknown> | null = null;
const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({ maybeSingle: () => Promise.resolve({ data: currentUser, error: null }) }),
        }),
      }),
      update: updateSpy,
    }),
  }),
}));

import { handleUpdate } from "./handlers";

function msg(text: string, tgId = 42): { update_id: number; message: unknown } {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: tgId, is_bot: false, language_code: "ru" },
      chat: { id: tgId },
      text,
    },
  };
}

const ACTIVE = {
  id: "u1",
  telegram_id: 42,
  language: "ru",
  lifecycle_state: "active",
  onboarding_step: "verification_approved",
  phone_number: "+998900000000",
  phone_verified: true,
  verification_status: "approved",
};

function hasWebApp(markup: unknown): boolean {
  const kb = (markup as { inline_keyboard?: Array<Array<{ web_app?: unknown }>> })?.inline_keyboard;
  return !!kb?.some((row) => row.some((b) => !!b.web_app));
}
function callbackData(markup: unknown): string[] {
  const kb = (markup as { inline_keyboard?: Array<Array<{ callback_data?: string }>> })?.inline_keyboard;
  return (kb ?? []).flat().map((b) => b.callback_data ?? "");
}

describe("bot commands (owner spec 2026-07-10)", () => {
  beforeEach(() => {
    sent.length = 0;
    currentUser = { ...ACTIVE };
    updateSpy.mockClear();
  });

  it("/app: активному шлёт свежую inline web_app-кнопку", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/app") as any);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe(M.cmd_app_prompt.ru);
    expect(hasWebApp(sent[0].markup)).toBe(true);
  });

  it("/status: активному без замечаний → status_active + open-app", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/status") as any);
    expect(sent[0].text).toBe(M.status_active.ru);
    expect(hasWebApp(sent[0].markup)).toBe(true);
  });

  it("/status: needs_changes → рекавери-текст", async () => {
    currentUser = { ...ACTIVE, verification_status: "needs_changes" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/status") as any);
    expect(sent[0].text).toBe(M.status_needs_changes.ru);
  });

  it("/status: незавершённый бот-онбординг → зовёт /start (без open-app)", async () => {
    currentUser = { ...ACTIVE, lifecycle_state: "onboarding", onboarding_step: "bot_contact" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/status") as any);
    expect(sent[0].text).toBe(M.status_onboarding_bot.ru);
    expect(hasWebApp(sent[0].markup)).toBe(false);
  });

  it("/support: подставляет SUPPORT_URL", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/support") as any);
    expect(sent[0].text).toContain("https://t.me/baxtlilar_support");
    expect(sent[0].text).not.toContain("{url}");
  });

  it("/language: показывает setlang-клавиатуру (не онбординговую lang:)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/language") as any);
    expect(sent[0].text).toBe(M.language_ask.ru);
    expect(callbackData(sent[0].markup).sort()).toEqual(["setlang:ru", "setlang:uz"]);
  });

  it("/privacy: HTML-сообщение с юр-ссылками", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/privacy") as any);
    expect(sent[0].parseMode).toBe("HTML");
    expect(sent[0].text).toContain("/legal/privacy.pdf");
    expect(sent[0].text).toContain("/legal/rules.pdf");
  });

  it("парсинг команды: /status@botname роутится как /status", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/status@baxtlilar_uz_bot") as any);
    expect(sent[0].text).toBe(M.status_active.ru);
  });

  it("парсинг команды: /statusx НЕ матчит /status (падает в promptStep)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleUpdate(msg("/statusx") as any);
    // active-юзер в promptStep получает already_active, НЕ status_active
    expect(sent[0].text).toBe(M.already_active.ru);
  });
});
