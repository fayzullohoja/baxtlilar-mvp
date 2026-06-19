# Security audit — Baxtlilar — 2026-06-19

> **Журнал закрытых пунктов (обновляется по мере исправлений):**
>
> - **2026-06-19** SMS-OTP rip + бот-регистрация → **закрывает F-002, F-101..F-105, F-117, F-004 (биометрия отдельным consent с IP/UA/text_hash), плюс direct-browser-block для мини-аппы**. Коммиты c477b34 + a065f25 + 9e5054a.
> - **2026-06-19** Origin-allowlist CSRF + `SameSite=None; Secure` для `bx_session` + Railway IP → **закрывает F-010, F-011**. Коммит e05f677.
> - Подробности — в `docs/improvement-log.md` (одна запись на пункт).


Параллельный аудит 10 независимых поверхностей (auth/sessions, onboarding-IDOR,
chat+safety+matching, admin/RBAC, storage/uploads, data-layer/SQLi,
PII/privacy/legal, SMS/OTP, headers/CSP/proxy, deps/secrets/logs, business/abuse).
Прочитано **полностью** 38 API-роутов и весь `src/lib/**`, 14 миграций, конфиги,
`.env*` (без коммита в git), package.json/pnpm-lock + `pnpm audit --prod`. Все
агенты read-only.

## Общая посту́ра

**Архитектура крепкая.** HMAC initData по спеке Telegram, scrypt + timing-safe
сравнение, query-builder без SQLi-сюрпризов (идентификаторы по allowlist,
значения параметризованы, embed/dotted падает громко), append-only audit-лог
через триггер на UPDATE, optimistic concurrency через `transition_user`,
signed URLs HMAC-SHA256 для приватных бакетов, magic-byte MIME, фильтр
блокировок в feed/chat-list, минимизация полей в `mini-profile` (нет
телефона/telegram_id наружу). Это всё держится.

**НО.** Шесть блокеров делают публичный запуск физически опасным или
юридически невозможным:

1. **Прод сейчас на `SMS_PROVIDER=mock` → OTP всегда `123456`** (DEP6) —
   любой при знании номера получает сессию.
2. **`.env.access` лежит на диске с боевыми кредами** — Railway token,
   `PGPASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`
   (DEP1).
3. **Юр-документы — черновики** («Qoralama», заглушки оператора/ИНН/DPO);
   все собранные согласия юридически ничтожны (P1). Биометрия (паспорт +
   селфи) собирается без отдельного согласия (P2). Хранилище и БД — вне РУз
   (P5).
4. **Идентификационный кольцевой evasion**: после удаления аккаунта телефон
   высвобождается, паспорт/селфи не хешируются — один человек крутит
   delete→re-register→те же доки, обнуляя жалобы/блоки жертвы (B1+B2).
5. **Блок не закрывает чат-комнату**: SSE/messages/read/typing продолжают
   обслуживать заблокированного (C2/C17). Анти-контакт фильтр обходится
   ≥8 способами (C1).
6. **CSRF + SameSite**: `bx_session` сейчас `Lax`. Под Telegram WebView
   придётся переключить на `None+Secure` — и без одновременной защиты
   Origin/CSRF-token любой evil.com сможет дергать /api/admin/users/[id]/ban
   и /api/account при логине жертвы (A11/H5/H8/ADM1/O17).

К ним добавляется системный класс: `trustedIp()` написан под Vercel, на
Railway возвращает `"unknown"` всем — admin-throttle и forensic IP в
audit-логе мёртвы (A1/ADM2/DEP3/H9). И GDPR-erasure неполна: `telegram_id`
не обнуляется, `reports.comment` у target не чистится, ошибки мутаций
проглатываются — формальное право на стирание не выполняется (D1, P6, P9).

Всего ≈150 находок до дедупа, ≈80 после. Полный набор в выводах подагентов.
Здесь — каноничная нумерация (F-001..) сгруппированная по приоритету.

---

## P0 — БЛОКЕРЫ запуска (CRITICAL)

| ID | Срез | Что | Источник |
|---|---|---|---|
| F-001 | Ops | Боевые секреты на диске `.env.access` — компрометация = полный takeover | DEP1 |
| F-002 | SMS | Прод в mock-режиме, OTP=123456 | DEP6 + SMS13 |
| F-003 | Legal | Юр-документы — ЧЕРНОВИКИ; consents юридически ничтожны | P1 |
| F-004 | Legal | Биометрия (паспорт+селфи) без отдельного consent | P2 |
| F-005 | Legal/Infra | ПД (паспорта, селфи, БД) хранятся вне РУз | P5 |
| F-006 | Abuse | Phone unique + soft-delete = бесконечная переподписка с тем же телефоном (обход блоков/жалоб) | B1 |
| F-007 | Abuse | Нет дедупа passport/selfie — catfish и фермы аккаунтов | B2 |
| F-008 | Chat/Safety | Блок не закрывает уже открытую чат-комнату (SSE/messages/read/typing продолжают работать) | C2+C17 |
| F-009 | Chat/Safety | Анти-контакт фильтр обходится: «телега», `@саша` (Cyrillic), `9  0  1`, `.io/.app/wa.link`, word-to-digit | C1 |
| F-010 | Auth/CSRF | Нет CSRF-защиты + SameSite-Lax под Telegram WebView сломается; флип на None без Origin-чека = открытый CSRF | A11+H5+H8+ADM1+O17 |
| F-011 | Ops/Throttle | `trustedIp()` написан под Vercel, на Railway всем `"unknown"` — admin-throttle коллапсирует в одну корзину, audit-IP бесполезен | A1+ADM2+DEP3+H9 |
| F-012 | Privacy/GDPR | Удаление аккаунта не стирает `telegram_id`, не чистит `reports.comment` у target, не схлопывает ghost-peer в chat-list; мутации не проверяют `.error` | D1+P6+P7+P9 |
| F-013 | Legal | Bump `LEGAL_VERSION` не инвалидирует прошлые согласия (пользователь продолжает «соглашаться» со старым) | P3 |

## P1 — HIGH (1–2 спринта)

| ID | Срез | Что | Источник |
|---|---|---|---|
| F-101 | SMS | Race на parallel `sendOtp` — cooldown/cap игнорируется | SMS1 |
| F-102 | SMS | `verifyOtp` не привязан к `phone` — старый OTP на новом телефоне | SMS2 |
| F-103 | SMS | Нет per-IP / per-session rate-limit — SMS-bomb через ротацию номеров | SMS3+O9 |
| F-104 | SMS | `SMS_STRICT` гард ленивый (не падает на cold-start) | SMS10 |
| F-105 | SMS | mock-логирует phone+OTP plaintext | DEP2+P11 |
| F-106 | Storage | TTL signed-URL для фото = 1ч; не привязан к сессии; нет per-access audit для документов; doc-filename фиксирован → upsert замазывает evidence | S3+S8+P12 |
| F-107 | Photos | Race на photo upload — пользователь загружает >3 (TOCTOU) | O1 |
| F-108 | Profile | `display_name` пускает контакты в карточку (фильтр только на bio/чате) | O6 |
| F-109 | Feed/Scrape | `/feed/skip` без квоты → полное вычерпывание базы; нет квот на feed/profile views | C5+B5+B15 |
| F-110 | Reports | Нет cap per-reporter / per-target; нет контекстной проверки (chat_id/recent view) | C6+C13+B3+B16 |
| F-111 | Auth | Нет server-side ревокации сессий — украденный cookie живёт 8ч (admin) / 30д (user) | A6+A12+ADM3 |
| F-112 | Auth | Смена телефона на верифицированном аккаунте не требует re-auth + OTP на старый номер | A10 |
| F-113 | Auth | Нет replay-protection initData кроме 3ч `auth_date` (нет seen-hash) | A5 |
| F-114 | DB | Mutation-роуты глотают `error` (account-delete, chat last_message_at, typing, photo-promote, bootstrap) — нарушает право на стирание | D1 |
| F-115 | DB | Нет `statement_timeout`, нет `pool.on('error')`, нет `application_name` — DoS-резильентность нулевая | D2+D10 |
| F-116 | Headers | CSP допускает `'unsafe-inline'` для скриптов | H1+DEP8 |
| F-117 | Headers | `/api/health` и `/api/auth/bootstrap` отдают raw DB error + commit SHA анонимам | H7+H10+DEP7+DEP11 |
| F-118 | Legal | Нет endpoint'а экспорта данных (право на доступ ст. 25) | P14 |
| F-119 | Admin | Одиночное модераторское решение по бану/одобрению ID/доступу к доку | B7 |
| F-120 | Admin | Moderator имеет тот же data-access что superadmin | B8 |
| F-121 | Crypto | Биометрические байты без envelope-encryption — leak service-role/госкоэрция = plaintext всех паспортов | B9 |
| F-122 | Abuse | Нет device-fingerprint / IP-корреляции при регистрации | B6 |

## P2 — MEDIUM (укрепление)

| ID | Что | Источник |
|---|---|---|
| F-201 | scrypt N=16384 → N=2^17 или argon2id | A7+DEP9 |
| F-202 | Realm-separation: HKDF → ADMIN_SECRET / USER_SECRET / STORAGE_SECRET | A2+H17 |
| F-203 | Anti-flood per-user (а не per-chat) — 30 msg/10s глобально | C4 |
| F-204 | SSE: heartbeat 3s, lifecycle re-check в цикле, per-user concurrent cap, LISTEN/NOTIFY | C8+C10+C11 |
| F-205 | Accept-after-block race → process_interest_accept в одной RPC | C9 |
| F-206 | `/typing` без rate-limit и без `areBlocked` | C3 |
| F-207 | 72h auto-decline ленивый — добавить pg_cron каждые 5 мин | C7 |
| F-208 | `transition_user` allowlist patch-ключей в SQL (raise на unknown) | D3+D5+O10 |
| F-209 | `upsert` без `excludeOnUpdate` для `created_at` | D8 |
| F-210 | `Content-Length` cap до `req.formData()` (busboy/stream) | O2+S6 |
| F-211 | Per-user upload rate-limit (5/min) | S7 |
| F-212 | Canonicalize path в `verifyStorageSig` + bucket allowlist + base64url-decode compare | S1+S2+S4 |
| F-213 | Symlink через realpath / `O_NOFOLLOW` | S16 |
| F-214 | `Content-Disposition: attachment` + `CSP: default-src 'none'; sandbox` на /api/storage GET | S11+S12 |
| F-215 | EXIF/GPS strip через `sharp` (`withMetadata({})`) | S14 |
| F-216 | `STORAGE_DIR` abs-path required в prod | S15 |
| F-217 | `audit_log` retention + анонимизация на erasure; запретить `DELETE` (или вывести в отдельный sink) | P10+ADM7 |
| F-218 | doc-reveal: проксировать через сервер вместо отдачи signed URL клиенту | ADM6 |
| F-219 | `reason` max 500 chars, sanitize push body (URL/контактный фильтр) | ADM5+B12+P15 |
| F-220 | UZ mobile-prefix allowlist в phone validate | SMS4 |
| F-221 | `AbortSignal.timeout(10_000)` на Eskiz `fetch` | SMS5 |
| F-222 | Не лить upstream body в throw (Eskiz token leak) | SMS6 |
| F-223 | `phone_taken` → не отдавать как 409, делать «мокаем отправку» | SMS7 |
| F-224 | `Cache-Control: private, no-store` на auth-страницах | H13 |
| F-225 | Permissions-Policy расширить (payment, usb, accelerometer, …) | H12 |
| F-226 | CSP `report-to` endpoint + `/api/csp-report` | H3 |
| F-227 | `img-src` сузить до telegram-CDN + 'self' (убрать `https:`) | H4 |
| F-228 | Graduated sanctions API (`sanction_level` enum уже есть) | B17 |
| F-229 | Append-only audit sink (S3 object-lock или соседний PG-роль INSERT-only) + алёрты | B18 |
| F-230 | Two-person rule на permanent ban | B7 |
| F-231 | Moderator: out-of-queue doc view = alert | B8 |
| F-232 | PostCSS bump (`pnpm.overrides`) | DEP5 |
| F-233 | pg `rejectUnauthorized: true` + Railway CA | DEP4 |
| F-234 | `SET search_path = public, pg_temp` на каждой PL/pgSQL функции | D4 |
| F-235 | Message длина считать grapheme/byte, NFKC + strip combining-marks | C15 |

## P3 — LOW (cleanup, мини-полировка)

Сюда уходят: A8 (throttle counter reset), A9 (env cache гард), A12-A15
(deleted/blocked/cookie path), O3 (is_main race after delete), O4 (quiz vector spoof),
O7 (docs upsert overwrites approved), O12 (gender re-validate), O15
(retry vs revoked), O18 (loadUserForStep no-arg case), C11 (SSE log-leak),
C18 (CSRF JSON), C19/C20/C14/C16 (negative findings — оставить как
explicit-pass), ADM4 (replay padding), ADM8 (login key как ip), ADM9 (throttled
vs invalid), ADM11 (admin self-service pwd reset), ADM13 (post-transition
side-write), ADM14 (role text vs enum), S5 (PDF/HEIC mime), S9
(`crypto.randomUUID()` вместо `Date.now()`), S17 (stream вместо readFile),
D6 (NaN на limit), D7 (not(col, op) runtime validate), D9 (rpc set-returning
detection), D11 (preserve error.code), D12 (advisory hash collision),
P15/P18/P19/P20, SMS8 (timingSafeEqual на OTP), SMS9 (`/^\d{6}$/`), SMS11
(Eskiz token shared cache), SMS12 (per-phone daily cap), SMS14
(phone_verified_at desync), H11 (robots.txt), H14 (frame-ancestors t.me),
H15/H16, B14 (deleted-sender race).

---

# План доработки

Дисциплина: каждая фаза должна СНАЧАЛА покрыться интеграц-тестом (vitest)
красным, потом фикс, потом зелёный + ручной e2e на проде (`/api/health`
после деплоя). В `docs/improvement-log.md` — одна запись на пункт
(дата · что нашли · почему баг · как починили · как проверили).

## Фаза 0 — операционный hot-fix (СЕГОДНЯ, ~2–4 часа)

| # | Действие | Источник | Owner |
|---|---|---|---|
| 0.1 | Ротировать ВСЕ секреты из `.env.access`: Railway token, `PGPASSWORD`, `ADMIN_PASSWORD` (20+ символов), `SESSION_SECRET` (`openssl rand -base64 32`), `TELEGRAM_BOT_TOKEN` (через @BotFather). Файл вынести в `~/.config/baxtlilar/access.env` chmod 600. Добавить `gitleaks` pre-commit hook | F-001 | Owner+Claude |
| 0.2 | На прод-env Railway: `SMS_PROVIDER=eskiz` + `ESKIZ_EMAIL/PASSWORD/FROM/BASE_URL` + `SMS_STRICT=1`. Удалить логирование `text` в `src/lib/sms/index.ts:11`. Заменить hardcoded `"123456"` в `genCode()` на всегда-рандом | F-002, F-105, P3-LOW | Owner+Claude |
| 0.3 | `/api/health` отдаёт только `{ok, db, ts}` — убрать `dbError`, `commit` | F-117 | Claude |
| 0.4 | Сменить `genCode()` чтобы НЕ возвращать `"123456"`; в mock-моде только лог (без тела) | F-105 | Claude |

**Verify (Фаза 0):** старая сессия не пускает; реальный Eskiz SMS приходит
(не 123456); `curl /api/health` не содержит SHA/dbError; `git ls-files | grep env`
пусто.

## Фаза 1 — pre-launch блокеры (~1–2 недели)

### Юридический трек (owner: юрист РУз + PO)

| # | Действие | Источник |
|---|---|---|
| 1.L1 | Получить от юриста с лицензией РУз настоящие тексты ToS / Privacy / Offer + согласие на ПД с реквизитами Оператора, ИНН, DPO, сроком хранения; вписать в `src/content/legal.ts` | F-003 |
| 1.L2 | Завести отдельный consent-type `biometric`. UI: отдельная галочка «Согласен на обработку селфи + изображения паспорта». Сервер: вставлять только реально принятые | F-004 |
| 1.L3 | План локализации хранилища+БД в УЗ (UCloud/UzCloud/InfraHost, реестр UZINFOCOM). До переезда — только закрытая beta | F-005 |
| 1.L4 | В `consents` добавить `ip`, `user_agent`, `language`, `consent_text_sha256`. Передавать в роут `request` | F-013 |
| 1.L5 | Bump `LEGAL_VERSION`-гард в `proxy.ts`: при отсутствии актуальной версии consents — `/legal/update` модал до возврата | F-013 |

### Кодовый трек (owner: Claude)

Идут отдельными PR. Жирным — слияние в `main` блокировано без интеграц-теста.

| # | Действие | Источник |
|---|---|---|
| 1.1 | **CSRF + SameSite парой**: `bx_session` → `SameSite=None; Secure; Partitioned`; добавить Origin/Referer allowlist (`telegram.org`+own origin) во ВСЕ POST/PUT/DELETE через wrapper. Для admin POST дополнительно double-submit CSRF-token. `bx_admin` остаётся `Lax`, `path=/admin` | F-010 |
| 1.2 | **`trustedIp()` под Railway**: читать `x-envoy-external-address` или правый сегмент `x-forwarded-for`; если NODE_ENV=production и нет — `console.warn`, fallback на socket | F-011 |
| 1.3 | **GDPR `erase_user(uid)` RPC**: транзакционно (a) обнулить/захешировать `telegram_id`, (b) обнулить `phone_number`, (c) анонимизировать `reports.comment` для `target_user_id=uid`, (d) обнулить `chat_messages.body` для sender=uid, (e) `lifecycle_state='deleted'`. Каждая мутация в роуте `/api/account` через `unwrapMutation()` (throw on error). + `getMiniProfiles` LEFT JOIN на `users.lifecycle_state` → лейбл «Пользователь удалил аккаунт» | F-012, F-114 |
| 1.4 | **Phone re-register cooldown 90 дней**: новая таблица `phone_blacklist(phone_hash, until)`. На `delete` — INSERT. На `bootstrap`/`phone_input` — SELECT и блок | F-006 |
| 1.5 | **passport/selfie identity binding**: на upload — `sha256(bytes)` + pHash в `user_documents.passport_hash/selfie_phash`. На approve — отказ если `passport_hash` уже approved у другой active записи; pHash >0.97 → warning модератору | F-007 |
| 1.6 | **Block tear-down**: `loadChatRow` → проверять `areBlocked`, возврат 403; SSE-цикл `break` если `areBlocked` стал true; страница `/chats/[id]` редирект если block; `/typing`/`/read`/`/messages` (GET и POST) — общий гард | F-008 |
| 1.7 | **Анти-контакт v2** в `src/lib/profile/schemas.ts`: многопроходный (NFKC, zero-width strip, collapse separators, Cyrillic→Latin homoglyph fold, расширенный словарь мессенджеров `тг/телега/инста/signal/discord/wickr/session`, word-to-digit RU/UZ, TLD-suffix list). Применить ТОЖЕ к `display_name` | F-009, F-108 |
| 1.8 | **Квоты на использование**: `bump_quota` поднять с `interests:5, views:30` → подключить `views, skips, profile_opens, reports, blocks`. Per-user-per-day: feed 100, skip 200, profile 200, report 5, block 20. `/api/report`: чек активного chat_id ИЛИ recent profile_view; дедуп fail-closed | F-109, F-110 |
| 1.9 | **SMS hardening**: новый RPC `request_otp(user_id, phone)` под `pg_advisory_xact_lock(hashtext(phone))` — атомарно cooldown + insert. `verifyOtp(userId, phone, code)` бинить phone. Per-IP rate-limit (10 OTP/hr). `AbortSignal.timeout(10_000)` на Eskiz `fetch`. Eager `env()` вызов в `instrumentation.ts` (срабатывает на boot) | F-101, F-102, F-103, F-104 |
| 1.10 | **Server-side session revocation**: таблица `admin_sessions(sid, admin_id, revoked_at, iat)` + `user_sessions` аналогично. Cookie payload = только `sid` (128-bit random). `getAdminSession/getCurrentUser` проверяет `revoked_at IS NULL`. Logout/ban/delete пишут `revoked_at` | F-111 |
| 1.11 | **Phone change re-auth**: на смену уже верифицированного телефона — отправлять OTP на СТАРЫЙ + Telegram push «телефон изменён» | F-112 |
| 1.12 | **Replay protection initData**: таблица `init_data_seen(telegram_id, hash, ts)`; дедуп при bootstrap. Альтернативно — monotonic `last_auth_date_seen` per user | F-113 |
| 1.13 | **Photo upload race**: `add_profile_photo(user_id, path, ord)` RPC под `FOR UPDATE users`-row; реджектит при `count >= 3`. Удалить TOCTOU-логику с клиентского пути | F-107 |
| 1.14 | **Document integrity + signed URL ужесточение**: для `user-documents` TTL → 60s; HMAC бинить с `adminId`/`sessionId`; doc-filename → `userId/passport-{sha256}.{ext}` (без upsert); запретить upsert когда `status='pending_review'`; каждый успешный GET docs → запись в `admin_audit_log` (`kind=storage_get`) | F-106 |
| 1.15 | **`statement_timeout` + pool error**: в `src/lib/db/pool.ts` `options: '-c statement_timeout=10000 -c idle_in_transaction_session_timeout=60000 -c application_name=baxtlilar-web'`; `pool.on('error', logger.error)` | F-115 |
| 1.16 | **Health/bootstrap leak fix**: убрать `dbError`/`commit` из `/api/health`; в `/api/auth/bootstrap` логировать ошибки сервером, отдавать клиенту `{ok:false, error:"db"}` | F-117 |
| 1.17 | **CSP nonce-based**: убрать `'unsafe-inline'` для script через middleware-nonce (`crypto.randomBytes(16)`, заголовок `x-nonce`, layout прокидывает в `<Script nonce={…}>`) | F-116 |
| 1.18 | **Right of access export**: `POST /api/account/export` (rate-limit 1/24ч) → JSON-блоб `{profile, photos, quiz_answers, consents, chats[summary], reports[mine]}`, link 7 дней | F-118 |
| 1.19 | **Two-person rule на permanent ban**: ban требует подтверждения вторым superadmin'ом в 24ч, иначе откат. Промежуточный статус `pending_ban_confirmation` | F-119 |
| 1.20 | **Moderator data scope**: `verifications/[id]/doc` GET — только если `id` в open-case у этого модератора; out-of-queue access → 403 + alert | F-120 |
| 1.21 | **Biometric envelope-encryption** (план): per-user DEK (32 байта random), DEK encrypted-at-rest в `user_documents.dek_ciphertext` master-ключом из KMS отдельного вендора. Расшифровка только на view (audit-logged) | F-121 |
| 1.22 | **Device fingerprinting (лёгкое)**: IP /24 + Telegram `device_id` (если придёт в initData) + server-set rotating cookie. Surface в moderation UI как «N акк. с тем же FP за 30д» — мягкий signal, не hard block | F-122 |

**Verify (Фаза 1):** vitest интеграц-сьют (расширить с 122 → ~180);
ручной e2e на проде:

- реальный Eskiz SMS приходит, не 123456, в Railway logs нет phone+code;
- попытка POST `/api/account {action:"delete"}` затем bootstrap с тем же
  телефоном → 409 `phone_locked` ещё 90 дней;
- approve того же `passport_sha256` у другого юзера → reject «duplicate
  identity»;
- block: GET `/chats/[id]` → 403, SSE завершается, `/messages` POST/GET
  → 403;
- 200-й POST `/feed/skip` за день → 429;
- жалоба без активного чата с target → 403;
- evil.com POST `/api/admin/users/{id}/ban` → 403 (Origin mismatch);
- после `/api/account?action=delete`: `SELECT * FROM users WHERE id=…` →
  `phone_number=NULL`, `telegram_id IS NULL OR LENGTH=64` (sha256-hash);
  `reports.comment` у target — маска; chat-list у партнёра показывает
  «Пользователь удалил аккаунт»;
- `pnpm audit --prod` чисто (после `pnpm.overrides` для postcss).

## Фаза 2 — высокоприоритетное укрепление (~1 месяц)

Все F-201..F-235 из таблицы P2. По одному PR в день (`/loop`-стиль),
группировки:

- **2.A Crypto/Secrets** (F-201, F-202): scrypt N=2^17 (или argon2id) +
  HKDF realm-separation секретов.
- **2.B Chat/Safety perf**: F-203 anti-flood per-user, F-204 SSE perf,
  F-205 accept-after-block RPC, F-206 typing rate-limit, F-207 pg_cron
  auto-decline.
- **2.C Data discipline**: F-208 allowlist в `transition_user`, F-209
  `excludeOnUpdate`, F-234 `SET search_path`.
- **2.D Uploads hardening**: F-210 size-cap, F-211 rate-limit,
  F-212/213/214/215/216 path/symlink/CSP/EXIF/abs-path.
- **2.E Privacy retention**: F-217 audit retention, F-218 doc-reveal proxy.
- **2.F Admin polish**: F-219 reason cap + push sanitize, F-228 graduated
  sanctions, F-229 audit sink + алёрты, F-230/231 (если оставлены за
  спринтом 1).
- **2.G SMS polish**: F-220 UZ-prefix, F-221 timeout, F-222 token-leak,
  F-223 enumeration.
- **2.H Headers polish**: F-224 no-store, F-225 Permissions-Policy,
  F-226 CSP report-to, F-227 img-src.
- **2.I Deps**: F-232 postcss bump, F-233 pg SSL verify, F-235 message
  length grapheme/byte.

**Verify (Фаза 2):** интеграц-сьют ~250 тестов, semgrep-правила на
`'unsafe-inline'` и shared SESSION_SECRET, прод e2e чек-лист.

## Фаза 3 — cleanup (~ongoing)

Все LOW-находки из P3. Включать по 1–2 в `/loop`-итерацию параллельно с
основной разработкой. Не блокируют запуск.

---

# Anti-patterns которые НЕ исправляем сейчас

- Полная защита от государственной коэрции (key-escrow в нескольких
  юрисдикциях, split-key). Архитектурное решение, выходит за рамки кода.
- Полный device-fingerprint anti-fraud (Hash в TLS-fp, canvas-fp). Запах
  privacy; стартуем с лёгкого, эскалируем если abuse-уровень требует.
- Real-time face-recognition на approve. Дорого, сейчас pHash достаточно.

---

# Чек-лист «можно ли запускать паблик»

- [ ] F-001 секреты ротированы, `.env.access` вне репо-дир
- [ ] F-002 прод SMS=eskiz, OTP не 123456
- [ ] F-003/F-004 юр-тексты опубликованы (юрист подписал), биометрия — отдельный consent
- [ ] F-005 БД и storage в УЗ-юрисдикции (UZINFOCOM-реестр)
- [ ] F-006/F-007 phone-cooldown + passport-hash в проде, проверено фейковой переподпиской
- [ ] F-008 чат-комната закрыта после блока (e2e подтверждён)
- [ ] F-009 анти-контакт v2 проходит adversarial corpus
- [ ] F-010 CSRF + SameSite пара выкачена одним PR
- [ ] F-011 `trustedIp` под Railway, audit-IP не "unknown"
- [ ] F-012 `erase_user` RPC покрывает все ПД, integration-tested
- [ ] F-013 LEGAL_VERSION re-consent гард срабатывает
- [ ] Все P1 (F-101..F-122) закрыты или явно отложены с риск-меморандумом PO

Только после всех ✓ — открываем регистрацию для не-инвайтных пользователей.
