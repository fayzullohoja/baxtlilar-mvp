All anchors confirmed. Here is the full report.

---

# ADMIN GAP REPORT — Baxtlilar (основа для редизайна)

_Дата: 2026-07-01 · Репозиторий: `/Users/fayzullohoja/Code/baxtlilar` · Все ссылки `file:line` проверены против кода._

---

## 1. Резюме

**40 расхождений** по 5 областям. Счётчики (по всему набору, `kind` пересекает границы областей):

| kind | шт | | severity | шт |
|---|---|---|---|---|
| `data_mismatch` | 15 | | critical | 2 |
| `spec_gap` | 12 | | high | 17 |
| `design` | 8 | | medium | 14 |
| `missing_action` | 3 | | low | 7 |
| `bug` | 2 | | | |

**Главный вывод.** Три из этих сорока — это по сути три «корневых» дефекта, за которыми тянется всё остальное. (1) Один **критический live-баг** в верификации: цикл `needs_changes → повторная загрузка` возвращает пользователя в `pending_review`, но НЕ создаёт `verification_case`, из-за чего он попадает в счётчик дашборда, но исчезает из очереди и не открывается ни в одной карточке — модератор видит «есть работа», а очередь пуста. (2) Карточка клиента отстала от анкеты V4 на **13 полей и целые новые экраны** (finance, lifestyle, family-model, partner-extended, quiz), потому что `ProfileTab` не выбирает ни `extended` jsonb, ни десяток «горячих» колонок — одна перезапись `SELECT`+render закрывает почти всё. (3) У оператора **нет UI-поверхности** для действий над аккаунтом: даже уже написанные server-side ban/unban/unblock висят без кнопок, а hard-delete и restart-onboarding отсутствуют как класс. Дизайн admin↔mini-app расходится осознанно (это вопрос учредителю, не баг), а покрытие спеки Чат 7 — ~1–11 экранов из 22. Рекомендуемый порядок: сначала дешёвый P0-триггер, чинящий весь кластер верификации, затем перезапись `ProfileTab`, затем danger-zone.

---

## 2. Баг верификации: рассинхрон dashboard ↔ queue ↔ cases

### 2.1 Точная причина (VF-1, critical)

Инвариант, на котором держится вся очередь: `users.verification_status='pending_review'` ⟺ ровно один открытый `verification_case (state<>'closed')`. Он нигде не форсится — поддерживается вручную в двух местах, и оба пропускают один путь.

- `admin_reject_verification(outcome='needs_changes')` **закрывает** кейс (`verification_cases.state='closed'`) и ставит `users.verification_status='needs_changes'` (`supabase/migrations/20260627100400_admin_case_rpcs.sql:286-298`).
- Пользователь повторно подаёт заявку через `/api/onboarding/fix`. Роут делает `tryTransition(... verification_status:'pending_review', onboarding_step:'moderation_pending' ...)` — и **никакой вставки `verification_cases`** (`src/app/api/onboarding/fix/route.ts:58-63`). Сравни с `src/app/api/onboarding/selfie/route.ts:73-85`, где есть идемпотентный блок создания кейса.
- Итог: пользователь **считается** карточкой дашборда «Заявки на проверке» (`src/app/admin/page.tsx:29-31` считает `users.verification_status='pending_review'`), но у него **ноль открытых кейсов**. `loadMyQueue` и `loadUnassignedQueue` читают `verification_cases` (`src/lib/admin/load-queue.ts:90-99` `state<>'closed'`; `102-112` `state='new'`), поэтому он не в одной из очередей, и нет строки `/admin/cases/[id]`, которую можно открыть. Оператор видит ненулевой счётчик с акцентной рамкой, а работать не с чем. Пользователь **навсегда застревает** в `pending_review`.

Триггерится это на абсолютно штатном цикле needs_changes → перезагрузка (по машине состояний `src/lib/state-machine/types.ts:108` `needs_changes` уходит через `fix/route.ts`, не через `selfie/route.ts`). **Это первичный живой баг.**

### 2.2 Сопутствующие (тот же класс расхождения)

- **VF-2 (high)** — суперадминский `admin_unblock_verification` (`20260620920000_split_window_and_jti_fixes.sql:100-149`, 3-арг сигнатура под вызов роута `src/app/api/admin/users/[id]/unblock-verification/route.ts:38-42`) ставит `pending_review` + `onboarding_step='moderation_pending'`, но кейс **не создаёт**. Тот же провал на incident-response пути.
- **VF-3 (high)** — дашборд и очередь читают **разные источники истины**: счётчик = `users.verification_status='pending_review'` (`src/app/admin/page.tsx:29`), очередь = открытые `verification_cases` (`load-queue.ts:95`). Структурно они не могут совпасть: счётчик — per-user, очередь — per-case/per-assignee. Любой ненулевой разрыв = фантомная работа.
- **VF-4 (medium)** — guard `checkInQueueOrSuperPage`/`requireInQueueOrSuper` определяет «в очереди» как `pending_review AND lifecycle_state='onboarding'` (`src/lib/admin/guard.ts:328`, `:370`) — **третье, более строгое** определение. При этом основной новый поток `/admin/cases/[id]` (`cases/[id]/page.tsx:16-19`) зовёт только `requireAdmin()` и скоупит доступ по `assignee_id` внутри `CaseStudio.tsx:90`, **минуя guard целиком**. Две модели скоупинга (по колонкам юзера vs по назначению кейса) могут расходиться.
- **VF-5 (medium)** — кейс создаётся **всего в двух местах**: разовый backfill (`20260627100100_verification_cases.sql:85-92`) и `selfie/route.ts:80-84`. DB-триггера, авто-создающего кейс, нет. Инвариант держится на разрозненных ad-hoc вставках, а не на одном правиле.

### 2.3 Предложенный single-source fix

**Один AFTER INSERT OR UPDATE триггер на `users`** WHEN `new.verification_status='pending_review'`, вставляющий кейс `state='new'`, если открытого нет (идемпотентно, `NOT EXISTS`). Он ловит все пути (`transition_user` пишет `verification_status` обычным UPDATE, `admin_unblock_verification` — прямым UPDATE), атомарен, и закрывает **VF-1, VF-2, VF-5** разом. После этого:

- **VF-3:** переключить счётчик дашборда на тот же предикат, что и очередь — считать `verification_cases WHERE state<>'closed'` (не `users`), чтобы заголовочное число совпадало с тем, что реально открывается.
- **VF-4:** сделать кейсы единственным источником и в guard: «в скоупе» = «у юзера есть открытый кейс, назначенный этому админу (или unassigned+new)», убрав re-derive из колонок юзера.

После этого можно вынести ответственность за создание кейса из `selfie/route.ts` и `fix/route.ts` в БД — ни один будущий путь в `pending_review` не сможет регрессировать инвариант.

---

## 3. Карточка клиента vs анкета V4

**Корень (13 из 14 гэпов):** `ProfileTab` выбирает узкий список колонок и **никогда не выбирает `extended` jsonb** (`src/app/admin/clients/[id]/ProfileTab.tsx:41-45` — SELECT содержит только `display_name, gender, city, bio, marital_status, has_children, future_children_plan, religion, top_life_values, education, looking_for_gender, partner_age_min, partner_age_max, geo_preference, languages, status, published_at`). Экран рендера (`ProfileTab.tsx:113-135`) показывает только эти поля. Grep по `src/app/admin` + `src/lib/admin` на `finance`/`extended` даёт **ноль**. Одна перезапись `SELECT`+render закрывает всё, кроме квиза.

Ниже — по экранам анкеты V4, с указанием админ-таба (почти всё → **ProfileTab**).

| Экран V4 | Недостающие/устаревшие поля | ID · severity |
|---|---|---|
| **Внешность** (отсутствует целиком) | `height_cm`, `weight_kg` (рост/вес, участвуют в мэтчинге) | PD-01 · high |
| **Место рождения** (отсутствует целиком) | `birth_country/region/district/city` — самозаявленное место рождения. Hero/IdentityTab показывают `birth_place`, но это **паспортное** значение из `user_identity` (`load-client.ts:71`), не анкетное | PD-02 · high |
| **О себе** (частично) | `activity_field`, `employment_format`, `native_language` (лейблы `ACTIVITY_FIELDS`/`EMPLOYMENT_FORMAT`/`LANGUAGES_LIST` существуют). Сейчас только bio+education | PD-03 · high |
| **Семья** (частично) | `children_count`, `youngest_child_age` — есть только `has_children` (`ProfileTab.tsx:118`), нет «сколько/возраст младшего» | PD-04 · medium |
| **Ценности/религия** (частично) | `religion_practice`, `religion_partner_match` — есть только `religion` (`ProfileTab.tsx:120`) | PD-05 · medium |
| **Брак** (отсутствует) | `post_marriage_living` (значение `separate_near`→`separate` в V4-миграции) | PD-06 · medium |
| **Модель семьи** (отсутствует целиком) | `family_role_model`, `wife_work_after_marriage_view` (hot) + COLD `extended.family.decision_model`, `extended.family.household_responsibility_model` (V4 убрал `by_domain`, переименовал `flexible→mostly_partner`) | PD-07 · high |
| **Финансы (НОВЫЙ)** (отсутствует целиком) | весь `extended.finance`: `income_source_stability`, `financial_stability_importance`, `family_finance_management`, `financial_priorities[]`, `monthly_income_range`, `financial_obligations` | PD-08 · high |
| **Образ жизни (НОВЫЙ)** (отсутствует целиком) | весь `extended.lifestyle`: `lifestyle_pace`, `free_time_activities[]`, `daily_routine`, `bad_habits_level`, `nutrition_style`, `alcohol_level`, `drugs_use`. `alcohol_level`/`drugs_use` **релевантны для модерации** и невидимы модератору | PD-09 · high |
| **Партнёр (расширенный)** (частично) | `partner_height_min/max`, `partner_top_qualities[]`, НОВЫЕ V4 `partner_religion_match`, `partner_preferred_countries[]`. Сейчас только gender+age (`ProfileTab.tsx:122-133`) | PD-10 · high |
| **Базовое** | НОВЫЕ V4 `district`, `district_visible_public` + `region`, `country_of_residence`. Показан только `city` (`ProfileTab.tsx:116`). `IdentityTab.tsx:90` показывает `district_code`, но это **паспортный** район из `user_identity`, другое понятие | PD-11 · medium |
| **Приватность** | `profile_visibility_mode` (лейблы `PROFILE_VISIBILITY_MODE` есть) | PD-12 · medium |

**PD-13 (high) — квиз Big Five, отдельный фикс.** Результат в `quiz_results.vector` jsonb (`supabase/migrations/20260531000000_init_schema.sql:141-145`). Grep по `src/app/admin` на `quiz_results` — ноль. Психометрический вектор, на который опирается мэтчинг, **полностью невидим** в карточке, и нет вкладки под него (`ClientTabs` — только identity/profile/photos/activity/moderation, `src/components/admin-ops/ClientTabs.tsx`). Требует отдельной загрузки `quiz_results` + **новый таб/секция** (в отличие от остальных PD, которые чинятся одной SELECT-правкой).

**PD-14 (low) — источник gender/birth_date/citizenship.** Hero, IdentityTab показывают эти поля из **паспорта** `user_identity` (`load-client.ts:60-64`, `IdentityTab.tsx:59-65`, `ClientHero.tsx:11/94`), а не из самозаявленного `user_profiles`. У неверифицированного юзера (нет identity-строки) анкетные значения — единственный источник и почти не показаны. Затрагивает **ProfileTab + IdentityTab + Hero**. Фикс: брать gender/birth_date/citizenship из `user_profiles` и флагировать расхождения профиль↔паспорт.

---

## 4. Недостающие операторские действия

### 4.1 Общая проблема поверхности (OA-3, medium)

**Даже существующие** user-level действия (ban/unban/unblock-verification) **не имеют UI**: grep по `src/` не находит ни одного клиентского вызова `/api/admin/users/[id]/ban|unban|unblock-verification` (провязан только case blocking-reject через `DecisionPanel.tsx:57`). `ModerationTab.tsx` — полностью read-only (список кейсов и репортов, ни одной кнопки; первая строка `import "server-only"`). `ClientHero.tsx` — только пилюли статуса и copy-кнопки. `ClientTabs` — `[identity, profile, photos, activity, moderation]`, danger-zone нет. **Кнопкам DELETE/RESTART физически некуда встать** — surface надо построить.

**Куда встраивать.** Превратить `ModerationTab.tsx` в client-component «Danger zone» (или добавить секцию под ним / в `ClientHero`) по паттерну `DecisionPanel.tsx`: `'use client'` + `Button` (`@/components/admin-ops/Button`) + `Dialog` для подтверждения, `fetch` POST → `router.refresh()`, inline-ошибки. Видимость кнопок гейтить на `session.role==='superadmin'` (роль уже прокинута в `page.tsx:68` → OpsShell). Заодно провязать сюда же существующие ban/unban/unblock.

Спека Чат 7 это допускает как **суперадминские одиночные** действия при confirm+audit: запрещён только **массовый** delete (`chat7_admin.txt:2617`), и запрещён delete для **низших** ролей (`:9058`); есть фильтр статуса «Удалённые» (`:2537`) и требование аудита «удаления данных» (§2.2, `:9864`). Единичный delete/restart **spec-consistent, но не spec-specified**.

### 4.2 OA-1 — Hard-DELETE тест/спам-аккаунтов (missing_action, high)

Нет ни роута, ни RPC для жёсткого удаления. Единственный путь — **soft** `erase_user` (`supabase/migrations/20260620920000_split_window_and_jti_fixes.sql:35`), вызывается **только** из user-facing `/api/account?action=delete` (`src/app/api/account/route.ts:45,87`). Для throwaway-аккаунта `erase_user` **вреден**: (1) оставляет `users`-строку как tombstone (`deleted_at`+`lifecycle_state='deleted'`, обнуляет `telegram_id`/`phone`); (2) **вставляет `document_sha_blacklist`** для passport/selfie SHA + `/api/account` добавляет 90-дн `phone_blacklist` — засоряет анти-catfish blacklist мусорными тестовыми SHA/телефонами; (3) не трогает часть child-таблиц.

Сырой `DELETE FROM users WHERE id=$1` **безопасен**: все FK к `users(id)` — `on delete cascade` (consents, user_documents, user_profiles, profile_photos, otp_codes, quiz_answers, quiz_results, match_requests, match_views, chats, chat_messages, daily_request_quotas, user_state_transitions, reports, blocks — `init_schema.sql:56-256`; tg_outbox, start_token_uses, user_identity, verification_cases+case_events+case_notes). Единственные non-cascade — `document_sha_blacklist.source_user_id` и `phone_blacklist.linked_user_id`, оба `on delete set null` → DELETE не упадёт на restrict/no-action и корректно оставит анти-abuse tombstones. **Осторожно:** `case_events`/`case_notes` имеют append-only BEFORE UPDATE OR DELETE триггер (`20260627100100:52-58`), который срабатывает и на каскадных удалениях — надо удалить `verification_cases` так, как триггер разрешает (валидировать; возможно `session_replication_role` или SECURITY DEFINER). `admin_audit_log.entity_id` — plain text, не FK → аудит переживёт удаление строки.

**Фикс.** `POST /api/admin/users/[id]/delete`, superadmin-only по паттерну `unban/route.ts:16` (`session.role!=='superadmin' → 403`), с typed-confirmation body (`{confirm:'DELETE', reason}`, `reason.length>=3`) + `expected_updated_at` optimistic-concurrency (как `decision/route.ts:29`). RPC `admin_hard_delete_user(p_user_id, p_admin_id)` (single transaction): собрать пути storage ДО удаления, удалить `verification_cases` первым, затем `DELETE FROM users`. **Не** писать `*_blacklist` tombstones. `adminAudit({action:'hard_delete_user', ...})` (`guard.ts:40`) ДО исчезновения строки.

### 4.3 OA-2 — RESTART onboarding (missing_action, medium)

Нет пути сбросить юзера на повтор онбординга. Требуется: `onboarding_step='language'`, `verification_status/profile_completion/quiz_completion='not_started'`, `lifecycle_state='onboarding'`; wipe `user_profiles/profile_photos/quiz_answers/quiz_results/user_documents/user_identity/verification_cases`; **KEEP** `users`+`telegram_id` (якорь identity).

**Три ловушки, подтверждённые по коду:** (1) нельзя через `tryTransition` — `transition()` (`src/lib/state-machine/transitions.ts:59-66`) валидирует по **forward-only** `ALLOWED_TRANSITIONS`; откат назад → `TransitionError` → `{ok:false,error:'wrong_step'}`. Нужен отдельный RPC, обходящий guard. (2) Reset НЕ должен писать `*_blacklist` — иначе собственный passport/phone SHA юзера ляжет в blacklist и он не сможет ре-верифицироваться своим же документом (`document/route.ts:25`). (3) `consents` (`init_schema.sql:54`, юр-запись ip/user_agent/accepted_at) — KEEP-vs-WIPE это **политическое** решение, вынести наружу, не тереть молча.

**Фикс.** `POST /api/admin/users/[id]/restart-onboarding`, superadmin-only, confirm+reason+`expected_updated_at`. RPC `admin_restart_onboarding(p_user_id, p_admin_id, p_wipe_consents boolean)`: удаляет перечисленное (mind append-only trigger), UPDATE `users` на стартовые значения + сброс `sanction_level/paused_at/blocked_*`, сохраняя `telegram_id`; INSERT `user_state_transitions` вручную (как `erase_user`, `:89-93`). Guard против рестарта `blocked`/`pending_ban` (409), чтобы не отмывать бан. Спека Чат 7 отдельно упоминает более мягкий `request_re_verification` (`chat7_admin.txt`) — **не путать** с полным RESTART.

---

## 5. Дизайн — расхождения и развилка A/B (вопрос учредителю)

Admin построен **осознанно** как отдельный операторский инструмент (решение 2026-06-27, `src/app/globals.css:119-125`, «в духе Linear/Salesforce … никаких серифов в data-таблицах»). Полный re-skin — это **решение, а не дефект**. Конкретные оси расхождения (D0, low):

- **Палитра.** Admin: тёплый off-white (`--admin-bg #fafaf8`, `globals.css:127`) + глубокий slate-blue акцент (`--admin-accent #2d4a5c`, `:138`). Mini-app: paper `#faf6f1` (`:33`), но primary CTA — near-black ink `#0a0908` на paper (`v2/Button.tsx`), НЕ акцентный цвет; amethyst `#4a2c5a` почти не используется; coral `#e2526b` — V1-legacy, живёт только в `WelcomeBranded.tsx`. (В брифе «coral accent» — это legacy, не текущий primary.)
- **Типографика.** Admin: Inter везде, база 13px, JetBrains Mono для ПИНФЛ/паспорта. Mini-app: editorial serif-заголовки как hero-визуал (`--font-v2-display`, `globals.css:55`), крупнее (44/32/24px). Оба именуют вебшрифты, которые **не грузятся** (см. D6).
- **Плотность.** Admin: компактно, таблицы, 36px строки, 28-32px кнопки. Mini-app: «один объект на экран», max-width 420px, 24-32px паддинги, 16px full-width кнопки.
- **Компоненты.** Две отдельные реализации `Button` (`admin-ops/Button.tsx` vs `v2/Button.tsx`), два механизма токенов (TS-объект `ADMIN.*` из `admin-tokens.ts` vs CSS-переменные `var(--color-v2-*)`). Общего примитива нет.

### Развилка — РЕШЕНИЕ УЧРЕДИТЕЛЯ

- **(A) Сохранить ops-tool identity, отполировать.** Починить D1-D6, свести два токен-механизма к одному. Низкий объём, уважает намеренное разделение. **Рекомендуется.**
- **(B) Внедрить editorial-look в admin** (serif-заголовки, paper, amethyst/ink, низкая плотность). Высокий объём, **работает против** операторской эргономики (плотные таблицы хотят sans+узкие строки) и против принципа «no serifs in tables». Не делать целиком; если хочется editorial-заимствований — только login/dashboard chrome, не data-экраны.

### Конкретные дефекты токенов (входят в вариант A)

- **D1 (medium)** — editorial serif протекает в логотип admin: `OpsSidebar.tsx:94` рендерит «Baxtlilar Ops» с `fontFamily:'var(--font-v2-display)'` внутри инструмента с явным «никаких серифов». Самое явное столкновение двух DNA. → Inter.
- **D2 (medium)** — радиусы захардкожены и несогласованы; токены `--admin-radius:6px`/`--admin-radius-lg:8px` (`globals.css:155-156`) **не читаются нигде**. Карточки/диалоги=8, кнопки/поиск=6, пилюли/инпуты=4, а login-карточка=**10** (`login/page.tsx:65`) — one-off, не совпадает ни с чем. → провести всё через токены, убрать 10px.
- **D3 (low)** — «density modes» рекламируются (`globals.css:123`, токены `--admin-row-h` 36/28/44 `:151-153`), но **ноль консьюмеров**, нет `data-density`. Полу-построенная фича: либо провязать, либо удалить токены и claim.
- **D4 (low)** — мёртвые токены: `--admin-border-strong` (`:130`) не используется; utility-классы `.pinfl/.passport-num/.mono` (`:165-171`) не используются (компоненты инлайнят `ADMIN.fontMono`). → prune или adopt.
- **D5 (low)** — root layout body `bg-slate-100 text-slate-800` (`admin/layout.tsx:14`) — **третий** нейтрал (холодный Tailwind slate), отличный от `--admin-bg` и v2 paper. Латентен (OpsShell перекрашивает через `data-ops`), но даёт холодную вспышку при cold paint. → `--admin-bg` на уровне body.
- **D6 (low)** — именованные вебшрифты **не грузятся** ни в одной системе. Admin не грузит Inter/JetBrains Mono (fallback на system/Menlo). Mini-app грузит Geist, но токены v2 ссылаются на Inter/JetBrains Mono. Editorial display-serif (Druk/Kazimir) помечен «будет лицензировано» (`globals.css:53-55`), без `@font-face` → все v2-заголовки сейчас в Georgia/Times. Контраст типографики из брифа **частично аспирационный**. → грузить именованные шрифты или обновить токены на реально поставляемые (Geist).

---

## 6. Покрытие спеки Чат 7 (что не построено / отклоняется)

Построено ~экраны 1-11 частично (dashboard, verification/case studio, photos, reports-list, clients, analytics, audit). Из 22 экранов спеки:

- **SG-06 (critical) — нет экрана Blocks & Restrictions; ban/unban API есть, но не провязан в UI.** F-119 dispatcher существует server-side (`src/lib/admin/guard.ts:135` `dispatchBanAction`; роуты `ban`/`unban`), но UI его не зовёт. Старый UserActions удалён, `/admin/users` теперь redirect на `/admin/clients` (`src/app/admin/users/page.tsx:11-16`). Вне verification blocking-reject **админ вообще не может забанить/ограничить активного юзера** из консоли. _(То же отверстие, что OA-3 — не дублировать в подсчёте объёма.)_
- **SG-01 (high) — RBAC сведён к 2 хардкод-ролям** vs матрица спеки (18 ролей). `role in ('superadmin','moderator')` (`init_schema.sql:221`), зеркалится в `session.ts:10`, `guard.ts:11`. Всё гейтится бинарным `superOnly`/`role!=='superadmin'`. Нет per-permission модели, нет отдельных `view/download_identity_document`, `open_chat_for_complaint_review`. Обещание «минимально необходимых привилегий» неисполнимо.
- **SG-02 (high) — нет экрана Staff & Roles** (invite/change-role/block, last-activity). Нет `/admin/staff`, нет staff-API, `admin_users` без status/department/last_activity/invitation (`init_schema.sql:218-224`). Админы создаются только прямым INSERT в БД.
- **SG-03 (high) — нет 2FA/SSO**, только пароль. `login/route.ts:35` проверяет пароль → сразу `setAdminSession` (`:61`), без второго фактора; `admin_users` без totp-колонок. Утёкший пароль = полный доступ к паспортным PII и бан-правам.
- **SG-04 (high) — на дашборде нет SLA / capacity / «Требуют внимания».** `src/app/admin/page.tsx:59-103` — плоские счётчики (StatCards), нет due_at/priority/capacity/average_moderation_time. SLA-инфра минимальна (только 7-дн reclaim RPC `20260630010000_verification_case_sla.sql:12`). Цель «не проспать пожар» не выполнена.
- **SG-05 (high) — обработка жалоб неполна.** Спека Screen 9-10 требует detail-карточку + 8 действий. Построено: плоский superadmin-only список (`src/app/admin/reports/page.tsx`) + 3 перехода статуса (`report-actions.tsx:12-15` in_progress/action_taken/not_confirmed); `decision/route.ts:10` разрешает только status. Нет assignment, priority, evidence, related-chat, restriction, escalate-to-legal, notes; нет `/admin/reports/[id]`; в таблице reports нет priority/assigned_to/category/evidence (`init_schema.sql:241-251`).
- **SG-07 (high) — нет модерации контента анкет** (Screen 6/7). Есть только identity-верификация; текст анкеты (bio/цели) не гейтится апрувом перед публикацией в Matching. `ProfileTab` read-only (`ProfileTab.tsx:80`). Нет секции «Анкеты» в сайдбаре.
- **SG-08 (medium) — face-match = ручная 3-чекбокс аттестация**, без similarity_score / field-by-field comparison (`FaceMatchStep.tsx:17`). Разумный MVP-сабститут, но задокументированное **отклонение**: аудит «запуска сравнения фото» не восстановим. Закрытие: персистить 3 booleans в case-audit.
- **SG-09 (medium) — аудит не логирует просмотры чувствительных данных** (паспорт/селфи/PII), которые спека требует. `adminAudit` (`guard.ts:39`) зовётся только на WRITE. Просмотр паспорта в case studio / IdentityTab **не пишет** аудит (`load-case.ts:35`, `load-client.ts` подписывают URL без записи). `admin_audit_log` — plain insert без hash-chain. «Кто смотрел паспорт» для in-scope доступа не восстановить.
- **SG-10 (low) — clients directory показывает полные PII суперадмину без masking/reason-gate.** Спека требует маскирования phone/telegram/passport в списках + reveal по RBAC+reason+audit. Полный `IdentityTab` (ПИНФЛ, серия/номер, адрес; `load-client.ts:70-107`) рендерится без маски и reason (`IdentityTab.tsx:1`). Defensible для малого набора суперадминов, но отклонение от data-minimization; парно с SG-09.
- **SG-11 (medium) — целые операционные модули отсутствуют:** Тарифы/платежи (Screen 12), Family (13), Matching status (15), Интересы/чаты (16), Individual (17), Международные (18), Тест совместимости (19), Уведомления (20), Настройки системы (22). Grep — ни одной страницы под `src/app/admin`. Ближайшие по нужде: **System Settings** (режим регистрации + toggle модерации анкет), **International review queue**, **Notifications**.

---

## 7. Предлагаемый порядок работ (P0→P3)

Ключевое суждение: **severity ≠ объём**. Сортировка по обоим (много high-severity spec_gap'ов дороги в реализации → уходят в P2, несмотря на severity).

### P0 — критично + дёшево (сделать первым)
- **VF-1 триггер** `users → verification_cases` (§2.3). Малый объём (одна миграция), тянет за собой **VF-2, VF-3, VF-5** и выравнивает VF-4. **S.**
- **Провязать ban/restrict UI** в danger-zone карточки (**SG-06 = OA-3**). API уже написан (`dispatchBanAction`), нужен только client-component + Dialog. **S–M.**

### P1 — высокая ценность, средний объём
- **Перезапись `SELECT`+render в `ProfileTab`** (§3): одна правка одного файла раскрывает 13 полей (finance/lifestyle/family-model/partner-extended/базовое/приватность). **M.**
- **SLA-дашборд** (SG-04): due_at/priority/assigned_at на cases+reports, «Требуют внимания» с overdue-подсветкой. **M–L.**
- **Обработка жалоб** (SG-05): `/admin/reports/[id]` detail + assign/restriction/escalate/notes + evidence-гейт. **L.**

### P2 — важно, но дороже
- **Квиз-таб** (PD-13) + PD-14 (источник профильных полей). **M.**
- **Delete + Restart** действия (OA-1, OA-2) с RPC/confirm/audit. **M.**
- **RBAC / 2FA / Staff** (SG-01, SG-02, SG-03) — high severity, но **L объём** (новые таблицы, permission-guard, TOTP, staff-CRUD), поэтому не P0. **L.**
- Дизайн D1 (serif в логотипе), D2 (радиусы). **S.**

### P3 — polish / отложенное
- Дизайн-мелочи D3-D6, унификация токенов (вариант A). **S каждая.**
- SG-08 (persist face-match attestation), SG-09 (view-audit), SG-10 (masking/reveal). **M.**
- Отсутствующие модули SG-11: сначала System Settings + International queue + Notifications, затем Tariffs/Family/Individual/Matching-status. **XL суммарно.**

**Решения для учредителя, блокирующие часть работ:** (§5) развилка A vs B по дизайну; (OA-2) KEEP-vs-WIPE `consents` при restart; (SG-11) какие из 11 модулей входят в MVP.