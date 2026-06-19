// scripts/set-webhook.mjs
// Регистрирует webhook бота в Telegram. Запускать локально/из CI:
//   TELEGRAM_BOT_TOKEN=... APP_URL=https://baxtlilar-mvp-production.up.railway.app \
//   TELEGRAM_WEBHOOK_SECRET=... node scripts/set-webhook.mjs
//
// Без аргументов: подтянет .env.access если есть. Передаёт secret_token, чтобы
// `/api/telegram/webhook` мог отбраковать чужие POSTs (X-Telegram-Bot-Api-Secret-Token).

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
const url = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}
if (!url) {
  console.error("APP_URL is required (https://.../api/telegram/webhook будет собран из него)");
  process.exit(1);
}
if (!secret || secret.length < 16) {
  console.error(
    "TELEGRAM_WEBHOOK_SECRET требуется (минимум 16 символов). Сгенерируйте:\n" +
      "  openssl rand -hex 24",
  );
  process.exit(1);
}

const webhookUrl = `${url.replace(/\/$/, "")}/api/telegram/webhook`;

const payload = {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: false,
};

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!body.ok) process.exit(2);
console.log(`\nOK. Webhook: ${webhookUrl}`);
