# Onboarding Spec ↔ Code Diff (2026-06-19)

## Краткая сводка

| # | Spec | Что в коде | Action |
|---|---|---|---|
| 01 | Welcome-экран мини-аппы (4 языка, brand) | Только fallback `open-in-telegram`; внутри TG сразу `doc_upload` | SKIP |
| 02 | 4 документа consent'ов (terms/privacy/rules/pd) | Бот пишет `terms+privacy+pd`, нет rules, нет отд. pd-документа | MINOR |
| 03 | Язык + резидентство + страна + ветвление верификации | Только город УЗ enum; язык в боте; ветвления нет | SKIP |
| 04 | Подтверждение телефона через TG contact (UI-экран) | Бот `bot_contact` через reply-keyboard | SKIP (можно MINOR: src/source/timestamp) |
| 05 | Intro «зачем верификация» + выбор OneID/manual | Сразу `doc_upload`, OneID нет | MAJOR |
| 06 | Doc upload + чек-лист 5 пунктов + privacy-блок | Бэкенд полный, UI без чек-листа/инфоблоков | MINOR |
| 07 | Selfie + 5 требований + 2 CTA (камера/галерея) + footer | Один `selfie_hint`, один input | MINOR |
| 08 | Preview данных + read-only поля документа + submit | Шага нет; submit = upload селфи; полей нет | SKIP |
| 09 | «Отправлено»: «что дальше» (3 пункта), 2 кнопки | Один info-блок, без кнопок | MINOR |
| 10 | «В процессе»: статус, чек-лист отправленного, support | Один info-блок, без статусов и support | MINOR |
| 11 | Result-экраны: условный retry, категория причины | Retry всегда, одна строка `reject_reason` | MAJOR |
| 12 | Attribution-источник (11 опций + skip) | Шага и поля нет | MAJOR (low-prio) |
| 13 | Анкета-intro + 4 буллета + privacy | Сразу форма basic | MINOR |
| N1 | Push «личность подтверждена» — переписать tone | Старый текст с «знакомства» | MINOR |
| N2 | Bot bio / description в BotFather | Webhook есть, описания пусты | MINOR (конфиг) |

## Что уже в порядке (MATCH)

- Telegram contact как канал верификации телефона (вместо SMS) — реализовано даже строже спеки (`user_id === sender.id`)
- Doc upload бэкенд: magic-byte валидация, приватный бакет, SHA-256 дедуп, статусы, state-machine переход
- Selfie upload бэкенд: storage + sha + переход в `moderation_pending` атомарно
- State-machine гарды (`requireUserAtStep`) на pending/rejected/needs-changes
- Кнопка Open App в боте через подписанный токен
- Bot Privacy Policy и название «Baxtlilar» в BotFather
- Username `@baxtlilar_uz_bot` (приемлемо для MVP)
- `capture="environment"` / `capture="user"` для нативной камеры
- Двухязычие RU/UZ для рынка УЗ (EN/TR из спеки осознанно не нужны)

## Мелкие правки (MINOR) — короткий sprint

**Bot consent (screen-02)**
- `src/content/legal.ts` — добавить документ `rules` (slug), расширить тип; синхронизировать `LEGAL_VERSION` с `handlers.ts` (`2026-06-02` vs `2026-06-19`)
- `src/lib/telegram/bot/messages.ts` — в `pd_consent_ask` добавить URL `/legal/rules`
- `src/lib/telegram/bot/handlers.ts` — `recordConsent(..., ["terms","privacy","pd","rules"])`

**Doc upload UI (screen-06)**
- `src/app/[locale]/onboarding/document/page.tsx` — блок-чек-лист 5 пунктов + инфоблок «данные защищены»
- `messages/{ru,uz}.json` — ключи `doc_requirements_1..5`, `doc_privacy_title/body`, выровнять `doc_subtitle/doc_hint`
- (опц.) `src/components/onboarding/upload-form.tsx` — двустрочный лейбл

**Selfie UI (screen-07)**
- `src/app/[locale]/onboarding/selfie/page.tsx` — блок требований (`<ul>` x5), «Как это работает», footer (формулировку про «не сохраняется» НЕ дублировать — селфи реально хранится)
- `messages/{ru,uz}.json` — `selfie_extra`, `selfie_how_it_works`, `selfie_requirements[]`, `selfie_privacy_footer`

**Pending — отправлено (screen-09)**
- `src/app/[locale]/onboarding/pending/page.tsx` — 3 буллета «что дальше», privacy-блок, footer «если задержится — сообщим», 2 кнопки
- `messages/{ru,uz}.json` — `pending_steps_*`, `pending_privacy_*`, `pending_delay_note`, `pending_cta_ok/home`
- Клиентский компонент `PendingActions` (`tg.close()` / `router.push("/")`)

**Pending — в процессе (screen-10)** — те же блоки + status-row («В процессе» + relative time), checklist отправленного (doc/photo/selfie), support-link

**Анкета-intro (screen-13)**
- `src/app/[locale]/onboarding/profile/basic/page.tsx` — над `<AnketaBasicForm>` collapsible-блок с 4 буллетами + privacy-дисклеймер (рендерить, когда `display_name` пустой)
- `messages/{ru,uz}/Anketa.json` — `intro_title/subtitle/bullet_1..4/privacy/cta`
- Кнопку «Заполнить позже» — SKIP (противоречит mandatory-flow)

**Push «личность подтверждена» (notification)**
- `src/app/api/admin/verifications/[id]/decision/route.ts` (стр. 15-16) — заменить `PUSH.approve` на:
  `"✅ Ваш профиль успешно прошёл проверку.\nОткройте Baxtlilar, чтобы создать анкету. После публикации анкеты вам будут доступны рекомендации."`

**Bot bio/description (bot-window)**
- BotFather: `/setdescription`, `/setabouttext` для `@baxtlilar_uz_bot`
- (опц.) добавить в `scripts/set-webhook.mjs` вызовы `setMyDescription` / `setMyShortDescription` через Bot API — воспроизводимость из CI

**Phone — опционально (screen-04)**
- Колонки `phone_verification_source`, `phone_verified_at` в `users`, проставлять в `handleContact()` — букве спеки соответствует, продуктовой ценности ~0

## Крупные новые работы (MAJOR)

### 1. Verification-intro экран (screen-05, подмножество)
~2-3 ч. Файлы:
- `src/lib/state-machine/types.ts` — добавить шаг `verification_intro`
- `src/lib/state-machine/transitions.ts` — `bot_consent_biometric → verification_intro → doc_upload`
- Новый `src/app/[locale]/onboarding/verification-intro/page.tsx` (3 пункта зачем + кнопка)
- i18n-ключи

Бизнес-польза: снижает drop-off на загрузке документов — юзер понимает зачем сдаёт паспорт.
Зависимости: нет.

### 2. Категоризация причин отказа + условный retry (screen-11)
~1 день. Файлы:
- Миграция БД: колонка `reject_category ENUM('technical','blocking')` в `user_documents`
- `src/app/[locale]/onboarding/rejected/page.tsx` — блок «Что это значит» (3 li), `RetryButton` только если `technical`, кнопка «Понятно», дисклеймер «попыток ограничено»
- `src/app/api/onboarding/retry/route.ts` — 403 если `blocking`
- `needs-changes-form.tsx` — раздельные тексты по `target` вместо одного `reject_reason`
- Админка модерации — добавить выбор категории при отклонении
- i18n: `rejected_what_means_*`, `rejected_attempts_limited`, `rejected_understood`, `nc_reason_passport/selfie/data`

Бизнес-польза: защита от обхода ограничений (фейки, подозрение чужого документа) + лучшая UX для технических проблем.
Зависимости: процесс модерации (модератору надо где-то выбирать category).

### 3. Attribution-источник (screen-12)
~3-4 ч. Файлы:
- `src/lib/state-machine/types.ts` — шаг `attribution`
- Миграция: `attribution_source TEXT NULL` в `users` с CHECK на 11 значений + 'other'
- `src/app/[locale]/onboarding/attribution/page.tsx` + i18n
- Action `setAttributionSource(source | null)` с переходами `quiz → attribution → active` / `quiz → active` (skip)

Бизнес-польза: маркетинговая аналитика каналов привлечения.
Зависимости: нет. Можно после MVP-релиза.

### 4. OneID/MyID + резидентство + ветвление верификации (screen-05 полный)
Большой эпик. Требует продуктового решения, миграции БД (`residency`, `citizenship`, `verification_method`), внешней интеграции OneID/MyID, нового UI-флоу. Откладывать до выхода на диаспору.

## Намеренно пропускаем (SKIP)

- **Welcome-экран мини-аппы (01)** — bot-pivot: язык/контакт/consent/биометрия теперь в `@baxtlilar_uz_bot`, мини-аппа стартует с `doc_upload`. `open-in-telegram` — это только fallback для браузера.
- **Языки EN/TR (01, 03)** — рынок УЗ, RU/UZ достаточно.
- **Страна/резидентство/город свободным вводом (03)** — диаспора не таргет MVP; enum УЗ-городов нужен для матчинга.
- **Phone-экран в мини-аппе (04)** — переехал в бот, главное требование спеки («не SMS») выполнено даже точнее.
- **Preview-экран перед submit (08)** — юзер не вводит данные документа, серия/ДР извлекаются модератором из скана. Confirm-step = лишний клик.
- **Кнопка «Заполнить позже» на анкета-intro (13)** — после verify анкета mandatory для quiz→active.

## Приоритизация (рекомендованный порядок)

1. **MINOR-блок UI-копирайта (06, 07, 09, 10, 13)** — один день, выкатывается атомарно. Это самые видимые улучшения onboarding для нового юзера, без новых миграций и без риска.
2. **Push «личность подтверждена» (notification)** — 5 минут, одна строковая константа. Сразу убирает dating-tone из системных сообщений.
3. **Bot consent: 4-й документ rules + LEGAL_VERSION sync (02)** — юридически важно (юристу могло понадобиться разделение). Полчаса работы.
4. **Verification-intro экран (MAJOR #1)** — самый дешёвый из MAJOR, снижает drop-off на загрузке паспорта. Делать после MINOR-копирайта, чтобы не плодить разрозненных правок в onboarding.
5. **Категоризация причин отказа + условный retry (MAJOR #2)** — нужен модераторам уже сейчас (без этого фейки могут бесконечно ретраить). Требует координации с админкой.
6. **Bot bio/description в BotFather (bot-window)** — параллельно, конфиг.
7. **Attribution-источник (MAJOR #3)** — после MVP-релиза, чисто маркетинговая аналитика, не блокирует core-flow.

OneID/MyID и поля резидентства не делать, пока не будет продуктового решения о выходе на диаспору.