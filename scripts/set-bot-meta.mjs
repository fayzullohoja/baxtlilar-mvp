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

// Command menu — короткое.
const COMMANDS_RU = [{ command: "start", description: "Начать или продолжить" }];
const COMMANDS_UZ = [{ command: "start", description: "Boshlash yoki davom ettirish" }];

console.log("Setting bot meta for", `bot${token.slice(0, 10)}...`);

// 1) Short description (about) — RU by default + UZ override
await call("setMyShortDescription", { short_description: SHORT_RU });
await call("setMyShortDescription", { short_description: SHORT_UZ, language_code: "uz" });

// 2) Full description
await call("setMyDescription", { description: DESC_RU });
await call("setMyDescription", { description: DESC_UZ, language_code: "uz" });

// 3) Commands menu
await call("setMyCommands", { commands: COMMANDS_RU });
await call("setMyCommands", { commands: COMMANDS_UZ, language_code: "uz" });

console.log("\nVerify:");
const checks = [
  ["getMyShortDescription", {}],
  ["getMyShortDescription", { language_code: "uz" }],
  ["getMyDescription", {}],
  ["getMyDescription", { language_code: "uz" }],
  ["getMyCommands", {}],
  ["getMyCommands", { language_code: "uz" }],
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
