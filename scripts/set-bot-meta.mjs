// scripts/set-bot-meta.mjs
// Configures bot description, short description (about) and command menu via
// Telegram Bot API. Reproducible — should be the source of truth for these
// fields instead of clicking through @BotFather.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=... node scripts/set-bot-meta.mjs
// Without env, loads .env.access from the repo root.

import { readFileSync } from "node:fs";

function loadDotenv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadDotenv(".env.access");
loadDotenv(".env.local");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${token}`;

async function call(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.ok) {
    console.error(`✗ ${method}:`, JSON.stringify(body, null, 2));
    process.exitCode = 2;
    return false;
  }
  console.log(`✓ ${method}${payload.language_code ? ` [${payload.language_code}]` : ""}`);
  return true;
}

// Short description: показывается в карточке бота, в превью при шеринге.
// Лимит: 120 символов.
const SHORT_RU = "Серьёзные знакомства для создания семьи";
const SHORT_UZ = "Oilani yaratish uchun jiddiy tanishuvlar";

// Full description: показывается на странице профиля бота.
// Лимит: 512 символов.
const DESC_RU =
  "Baxtlilar — Telegram Mini App для серьёзных знакомств с целью создания семьи. " +
  "Проверенные анкеты, приватность и уважительное общение. " +
  "Откройте Mini App, чтобы пройти проверку и создать анкету.";
const DESC_UZ =
  "Baxtlilar — oilani yaratish maqsadida jiddiy tanishuvlar uchun Telegram Mini App. " +
  "Tasdiqlangan anketalar, maxfiylik va hurmatli muloqot. " +
  "Tekshiruvdan oʻtish va anketa yaratish uchun Mini App'ni oching.";

// Command menu (спец оунера 2026-07-10). Порядок = порядок в UI Telegram.
// Хендлеры: src/lib/telegram/bot/handlers.ts (handleUpdate switch).
const COMMANDS_RU = [
  { command: "start", description: "Начать / выбрать язык" },
  { command: "app", description: "Открыть Mini App" },
  { command: "status", description: "Статус профиля" },
  { command: "support", description: "Поддержка" },
  { command: "language", description: "Изменить язык" },
  { command: "privacy", description: "Приватность и правила" },
];
const COMMANDS_UZ = [
  { command: "start", description: "Boshlash / til tanlash" },
  { command: "app", description: "Mini App'ni ochish" },
  { command: "status", description: "Profil holati" },
  { command: "support", description: "Yordam" },
  { command: "language", description: "Tilni oʻzgartirish" },
  { command: "privacy", description: "Maxfiylik va qoidalar" },
];
const COMMANDS_EN = [
  { command: "start", description: "Start / choose language" },
  { command: "app", description: "Open Mini App" },
  { command: "status", description: "Profile status" },
  { command: "support", description: "Support" },
  { command: "language", description: "Change language" },
  { command: "privacy", description: "Privacy & rules" },
];
// TR — ПОДГОТОВЛЕНО, но НЕ регистрируем (стоп-фактор «Держим TR»: без ревью
// носителя + TR юр-PDF не катим). Строки бот-меню косметические (не тянут
// миграцию users.language) — включить = раскомментировать call ниже при запуске TR.
const COMMANDS_TR = [
  { command: "start", description: "Başla / dil seç" },
  { command: "app", description: "Mini App'i aç" },
  { command: "status", description: "Profil durumu" },
  { command: "support", description: "Destek" },
  { command: "language", description: "Dili değiştir" },
  { command: "privacy", description: "Gizlilik ve kurallar" },
];

console.log("Setting bot meta for", `bot${token.slice(0, 10)}...`);

// 1) Short description (about) — RU by default + UZ override
await call("setMyShortDescription", { short_description: SHORT_RU });
await call("setMyShortDescription", { short_description: SHORT_UZ, language_code: "uz" });

// 2) Full description
await call("setMyDescription", { description: DESC_RU });
await call("setMyDescription", { description: DESC_UZ, language_code: "uz" });

// 3) Commands menu (RU default + UZ/EN overrides; TR держим)
await call("setMyCommands", { commands: COMMANDS_RU });
await call("setMyCommands", { commands: COMMANDS_UZ, language_code: "uz" });
await call("setMyCommands", { commands: COMMANDS_EN, language_code: "en" });
// TR — держим до запуска турецкой локали (native review + TR юр-PDF):
// await call("setMyCommands", { commands: COMMANDS_TR, language_code: "tr" });
void COMMANDS_TR;

// 4) Menu button — глобальный дефолт (RU). Per-chat локализация (UZ/EN) ставится
// ботом на /start и при смене языка (setChatMenuButton не поддерживает language_code).
// web_app.url = КОРЕНЬ аппы без токена: живая 30-дневная bx_session cookie
// авторизует сразу; cookie-miss → штатный лендинг /open-in-telegram. H3
// (обязательный start_param в /api/auth/bootstrap) НЕ трогаем — вход по уже
// выданной сессии, не по initData.
const appUrl = (process.env.APP_URL ?? "https://baxtlilar-mvp-production.up.railway.app").replace(/\/$/, "");
await call("setChatMenuButton", {
  menu_button: { type: "web_app", text: "Открыть Baxtlilar", web_app: { url: `${appUrl}/` } },
});

console.log("\nVerify:");
const checks = [
  ["getMyShortDescription", {}],
  ["getMyShortDescription", { language_code: "uz" }],
  ["getMyDescription", {}],
  ["getMyDescription", { language_code: "uz" }],
  ["getMyCommands", {}],
  ["getMyCommands", { language_code: "uz" }],
  ["getMyCommands", { language_code: "en" }],
  ["getChatMenuButton", {}],
];
for (const [method, payload] of checks) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  const lang = payload.language_code ? ` [${payload.language_code}]` : "";
  console.log(`  ${method}${lang}:`, JSON.stringify(body.result));
}
