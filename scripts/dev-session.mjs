#!/usr/bin/env node
/**
 * DEV-ONLY: выдаёт локальную сессию мини-аппы в обход бота.
 *
 * Зачем: вход в мини-аппу требует start_param, который в норме выдаёт бот
 * (deep-link t.me/<bot>/app?startapp=<token>). Без TELEGRAM_BOT_TOKEN бот-плечо
 * недоступно, и UI локально не открыть вообще. Скрипт подписывает такой же
 * start-token напрямую (тот же HMAC на SESSION_SECRET, что и
 * src/lib/telegram/start-token.ts) и меняет его на cookie через
 * /api/auth/bootstrap. Проверку подписи initData снимает DEV_BYPASS_TG=1.
 *
 * Отказывается работать, если APP_URL не localhost или DEV_BYPASS_TG != 1.
 *
 * Usage:
 *   node scripts/dev-session.mjs                 # первый подходящий сид-юзер
 *   node scripts/dev-session.mjs --tg 800000007  # конкретный telegram_id
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const NS = "starttoken:v2:";

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local не найден - запускай из корня репозитория");
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function signStartToken(secret, uid, telegramId) {
  const payload = { uid, tg: telegramId, jti: crypto.randomBytes(16).toString("base64url"), iat: Math.floor(Date.now() / 1000) };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(NS + b64).digest().toString("base64url");
  return `${b64}.${sig}`;
}

const e = loadEnv();
const appUrl = e.APP_URL || "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(appUrl)) {
  console.error(`ОТКАЗ: APP_URL=${appUrl} не локальный. Скрипт только для разработки.`);
  process.exit(1);
}
if (e.DEV_BYPASS_TG !== "1") {
  console.error("ОТКАЗ: DEV_BYPASS_TG != 1. Без bypass'а initData не пройдёт проверку подписи.");
  process.exit(1);
}

const wantTg = (() => {
  const i = process.argv.indexOf("--tg");
  return i > -1 ? Number(process.argv[i + 1]) : null;
})();

const pool = new Pool({ connectionString: e.DATABASE_URL });
const { rows } = await pool.query(
  `select id, telegram_id, onboarding_step, lifecycle_state, language
     from users
    where lifecycle_state not in ('blocked','deleted')
      and onboarding_step not in (
        'bot_language','bot_invite_code','bot_contact','bot_consent_pd','bot_consent_biometric',
        'language','consent','phone_input','otp_pending'
      )
      ${wantTg ? "and telegram_id = $1" : ""}
    order by created_at
    limit 1`,
  wantTg ? [wantTg] : [],
);
await pool.end();

if (!rows.length) {
  console.error("Не нашёл подходящего юзера. Засей базу: node scripts/seed-10k.mjs --url \"$DATABASE_URL\" --n 200");
  process.exit(1);
}

const u = rows[0];
const startParam = signStartToken(e.SESSION_SECRET, u.id, Number(u.telegram_id));
const initData = new URLSearchParams({
  user: JSON.stringify({ id: Number(u.telegram_id), first_name: "Dev", username: "dev_local" }),
  auth_date: String(Math.floor(Date.now() / 1000)),
  hash: "dev-bypass-no-real-signature",
}).toString();

// --browser: отдаём готовый сниппет, чтобы bootstrap дёрнул САМ браузер и
// httpOnly-cookie bx_session легла именно в него (из шелла её туда не положить).
if (process.argv.includes("--browser")) {
  const snippet =
    `fetch('/api/auth/bootstrap',{method:'POST',headers:{'content-type':'application/json'},` +
    `body:JSON.stringify(${JSON.stringify({ initData, start_param: startParam })})}).then(r=>r.json())`;
  console.log(`Выполнить в консоли браузера на ${appUrl}, затем перезагрузить страницу:\n`);
  console.log(snippet);
  process.exit(0);
}

const res = await fetch(`${appUrl}/api/auth/bootstrap`, {
  method: "POST",
  // proxy.ts требует Origin на мутирующих /api/* (CSRF-гард, F-010)
  headers: { "content-type": "application/json", origin: appUrl },
  body: JSON.stringify({ initData, start_param: startParam }),
});
const body = await res.json().catch(() => ({}));

if (!res.ok || !body.ok) {
  console.error(`bootstrap не отдал сессию: HTTP ${res.status}`, body);
  process.exit(1);
}

const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
console.log("Сессия выдана.");
console.log(`  user_id:         ${body.userId}`);
console.log(`  telegram_id:     ${u.telegram_id}`);
console.log(`  onboarding_step: ${body.onboarding_step}`);
console.log(`  lifecycle_state: ${body.lifecycle_state}`);
console.log("\nCookie для curl:");
const loc = u.language ?? "ru";
console.log(`  curl -s "${appUrl}/${loc}/main" -H 'cookie: ${cookies.join("; ")}'`);
console.log(`\nЭкраны: /${loc}/main  /${loc}/requests  /${loc}/v2/welcome  /${loc}/v2/chats  /${loc}/v2/settings`);
console.log(`Сессию прямо в браузер: node scripts/dev-session.mjs --browser`);
console.log("\nДля браузера - выполнить в консоли на localhost:3000:");
for (const c of cookies) {
  const [k, v] = c.split("=");
  if (k === "bx_session") console.log(`  (bx_session httpOnly - через DevTools > Application > Cookies: ${k}=${v})`);
  else console.log(`  document.cookie = ${JSON.stringify(c + "; path=/")}`);
}
