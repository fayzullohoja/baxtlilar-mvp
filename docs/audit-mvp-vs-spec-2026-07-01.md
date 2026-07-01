The report is durable. My counts match the advisor's verification (43 confirmed real bugs; 1 critical / 7 high / 20 medium / 15 low; legal 18, system 11, anketa 9, safety 5, onboarding 0, matching 0). The three overturned findings (ONB-06, ONB-29, LEGAL-033) are correctly in section 3, not section 2. ADM-VER-014 is flagged in section 2A.

Now returning the full markdown as my output.

# Аудит Baxtlilar MVP: спецификация vs. код

Итоговый отчёт по сверке требований спецификаций (chat1–chat13) с фактической реализацией. Каждый пункт классифицирован по бакету (`real_bug` / `intentional_deviation` / `not_yet_built` / `false_alarm`) и по критичности. В раздел «Реальные баги» включены только подтверждённые верификацией находки (`confirmed = true`).

---

## 1. Резюме (Executive Summary)

### Распределение по бакетам

| Бакет | Кол-во |
|---|---|
| `false_alarm` (соответствует спеке / OD) | 85 |
| `real_bug` (подтверждённые) | 43 |
| `intentional_deviation` (осознанные решения) | 22 |
| `not_yet_built` (отложено, roadmap) | 26 |

### Подтверждённые real bugs (43) — по критичности

| Severity | Кол-во |
|---|---|
| critical | 1 |
| high | 7 |
| medium | 20 |
| low | 15 |

### Подтверждённые real bugs — по домену

| Домен | Кол-во |
|---|---|
| legal (правовые/согласия) | 18 |
| system (стейт-машина/enum) | 11 |
| anketa (анкета) | 9 |
| safety (безопасность) | 5 |
| onboarding | 0 |
| matching | 0 |

> **Главный вывод:** весь реальный риск сконцентрирован в правовом контуре. Единственный **critical** и **все 7 high**-багов — это домен `legal` (сбор чувствительных/специальных ПД без отдельного согласия, отсутствие статуса/отзыва согласия, отсутствие 2FA у персонала). Онбординг и матчинг — фактически чистые (0 подтверждённых багов): архитектурные отличия там объяснены ledger'ом (Shadow Active, BOT↔MINI APP split, Match of the Day).

### Топ-5 самых важных real bugs

1. **LEGAL-008 (critical)** — специальные/чувствительные ПД собираются без отдельного правового основания (отдельного согласия). Ни экрана, ни записи, ни отдельного документа. Вся правовая копия помечена DRAFT/requires-lawyer.
2. **LEGAL-006 / LEGAL-007 (high)** — финансовые и lifestyle/health-блоки анкеты уже собираются **живьём**, но отдельное согласие на чувствительные данные (C6), которое **прямо требует OD-4**, отсутствует полностью.
3. **LEGAL-005 / LEGAL-015 (high)** — у согласия нет поля статуса (active/withdrawn/outdated). Согласие невозможно отозвать на уровне данных, и нет админ-панели для просмотра правового статуса пользователя.
4. **LEGAL-023 (high)** — «удалить все данные» реализовано как жёсткий DELETE без матрицы хранения (нет retain-for-payments / retain-for-complaints / законных споров).
5. **LEGAL-028 (high)** — у персонала нет 2FA/TOTP вообще, и нет гранулярной RBAC-модели (только superadmin/moderator) для доступа к документам/селфи/чатам/жалобам.

> ⚠️ **Отдельно, вне раздела 2** (см. раздел 2A): **ADM-VER-014** заявлен как real_bug с severity **high**, но не прошёл финальную верификацию. Это единственный high-severity баг вне legal: просмотр паспорта/селфи в админке мятит signed URL **без запроса причины и без единой записи в аудит**. Требует подтверждения, но по сути — серьёзный комплаенс-пробел.

---

## 2. Реальные баги (`real_bug`, подтверждённые)

Сгруппировано по домену; домены упорядочены по максимальной критичности (legal → anketa → system → safety). Внутри домена — critical → high → medium → low.

### 2.1. Legal (правовые / согласия) — 18 багов

#### LEGAL-008 — [critical] Специальные ПД без отдельного правового основания
- **Требование:** чувствительные/специальные данные должны обрабатываться на строгом основании, требующем ОТДЕЛЬНОГО письменного/электронного согласия; основание и копия — с юристом.
- **Цитата:** chat8_legal — Основная часть п.7, Согласия п.251, п.3 л.5120, п.12 л.5404-5405.
- **Где:** `src/content/legal.ts:170-171` (privacy §2 упоминает спец-категории), отдельного артефакта согласия нет.
- **Что не так:** privacy-копия признаёт существование спец-категорий, но НЕТ отдельного согласия на чувствительные ПД (ни экрана, ни записи, ни отдельного документа). Строгое основание не реализовано. Вся правовая копия помечена DRAFT/requires-lawyer (`legal.ts:3-6`).

#### LEGAL-005 — [high] У PD-согласия нет статуса (active/withdrawn)
- **Требование:** при PD-согласии сохранять user ID, дату/время, версию текста, язык, источник, технический action-id, **статус согласия** (active/withdrawn); залогировать и привязать к пользователю.
- **Цитата:** chat8_legal — Экран 2, л.1203-1210, 1252-1263.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:54-61`; `supabase/migrations/20260619100000_bot_registration.sql:24-32`; `src/lib/telegram/bot/handlers.ts:246-268`.
- **Что не так:** таблица `consents` не имеет колонки `status`, `source`, `action-id`. Статус согласия невозможно представить на уровне данных → нельзя перевести запись в «withdrawn». Версия/дата/язык/пользователь сохраняются.

#### LEGAL-006 — [high] Чувствительные блоки анкеты собираются без отдельного согласия
- **Требование:** PD-согласие НЕ должно подразумевать согласие на чувствительные данные; согласие на чувствительные ПД — на отдельном Экране 3 до заполнения чувствительных полей.
- **Цитата:** chat8_legal — Экран 2 л.1227,1264; Экран 3 л.1297-1303,1343-1344.
- **Где:** `src/app/[locale]/v2/anketa/lifestyle/page.tsx`; `src/app/[locale]/v2/anketa/finance/page.tsx`; запись согласия — только в bot-хендлерах.
- **Что не так:** экрана и записи согласия на чувствительные данные нет нигде. Чувствительные блоки (finance, lifestyle/health/habits) — **живые в MVP** (RU-14) и собираются без отдельного гейта. Записывается только biometric-согласие. OD-4/RU-14 **требуют** отдельное согласие в Mini App — оно отсутствует (не whitelisted).

#### LEGAL-007 — [high] Нет экрана/записи согласия на чувствительные данные (Экран 3)
- **Требование:** согласие на чувствительные ПД (Экран 3): два чекбокса; «Продолжить» неактивна до обоих; сохранять user ID, дату/время, версию, язык, источник, **список категорий чувствительных данных**, статус, action-id.
- **Цитата:** chat8_legal — Экран 3, л.1332-1353.
- **Где:** grep по `src/app/api`, `src/app/[locale]/v2/anketa` — UI/записи согласия нет.
- **Что не так:** ни экрана, ни записи, ни списка категорий. `consents` также не имеет колонок status/source/action-id/category-list. Чувствительные данные анкеты уходят без гейта. (Пересекается с LEGAL-006/008 — один и тот же отсутствующий артефакт.)

#### LEGAL-009 — [high] Нет отдельного согласия на фото (Экран 4)
- **Требование:** согласие на фото (Экран 4) как отдельный шаг ДО любой загрузки фото: два чекбокса; «Продолжить» неактивна до обоих; сохранять user ID, дату/время, версию, язык, источник, тип согласия (photo/images), статус, action-id.
- **Цитата:** chat8_legal — Экран 4, л.1480, 1520-1540.
- **Где:** `src/app/[locale]/v2/anketa/photos/page.tsx`; `src/app/api/onboarding/profile/photo/route.ts` (согласия нет); `src/lib/uploads/storage.ts:43-70`.
- **Что не так:** экрана/записи согласия на фото нет. Эндпоинты загрузки фото не содержат обработки согласия; фото грузятся без гейта. `consent_type='photo'` не пишется никогда. OD-4 требует C5 (photos consent) отдельно в Mini App.

#### LEGAL-015 — [high] Нет enum статуса согласия + нет админ-вью правового статуса
- **Требование:** каждая запись согласия несёт enum статуса active/withdrawn/outdated; Admin Panel показывает правовой статус пользователя по каждому типу согласия.
- **Цитата:** chat8_legal — Dev л.5295; Admin л.5323-5331; Экран 2 л.1293.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:54-61` (+alters); `src/app/admin/*` (нет отображения согласий).
- **Что не так:** у `consents` нет колонки статуса вообще. Нет админ-страницы, показывающей согласия/правовой статус пользователя (grep по `src/app/admin`, `src/lib/admin` пусто). Отсутствуют обе половины.

#### LEGAL-023 — [high] Удаление данных — жёсткий DELETE без матрицы хранения
- **Требование:** «Удалить все мои данные» НЕ должно быть hard delete; разбивается на удалить-сразу / скрыть / обезличить / хранить-для-платежей / хранить-для-жалоб / хранить-для-споров по матрице хранения.
- **Цитата:** chat8_legal — п.19 л.616-654; Dev л.5311-5317.
- **Где:** `supabase/migrations/20260620920000_split_window_and_jti_fixes.sql:35-99`; `src/app/api/account/route.ts:45-106`.
- **Что не так:** `erase_user` жёстко DELETE-ит consents, user_documents, user_profiles, profile_photos, quiz_* сразу; обезличивает строку users + сообщения/комментарии, оставляя только SHA документов. Нет разбивки по матрице (нет retain-for-payments, отдельного retain для жалоб, нет классификации delete-immediately vs anonymize). OD-11 (soft-delete + anonymize) частично учтён (строка обезличена, lifecycle=deleted), но матрица не реализована.

#### LEGAL-003 — [medium] На согласии базовых доков не сохраняются source и action-id
- **Требование:** при акцепте базовых доков сохранять user ID, версию КАЖДОГО документа, дату+время, язык документа, источник согласия (TG Mini App/Web/Mobile), технический action-id; акцепт залогирован.
- **Цитата:** chat8_legal — Экран 1, л.1092-1098, 1123-1128.
- **Где:** `src/lib/telegram/bot/handlers.ts:239-268`; `supabase/migrations/20260531000000_init_schema.sql:54-61`; `supabase/migrations/20260619100000_bot_registration.sql:24-32`.
- **Что не так:** строка `consents` содержит user_id, consent_type, consent_version, accepted_at, language, ip, user_agent, consent_text_sha256. ОТСУТСТВУЕТ: нет колонки `source` (TG Mini App/Web/Mobile) и нет technical-action-id. Источник только неявно закодирован хардкодом `ip='tg-webhook'` / `user_agent='telegram-bot'`.

#### LEGAL-010 — [medium] Нет интерактивного предупреждения о фото третьих лиц/семьи
- **Требование:** предупреждение о фото третьих лиц/семьи с подтверждением прав или блюром; семейные фото не обязательны; MVP не должен поощрять детские фото.
- **Цитата:** chat8_legal — Экран 4, л.1553-1557,1563; п.5 л.257.
- **Где:** `src/app/[locale]/v2/anketa/photos/page.tsx`; `src/content/legal.ts:79-80,368-369` (копия prohibited-content).
- **Что не так:** в UI загрузки нет выделенного предупреждения/подтверждения по фото третьих лиц. Семейное фото опционально (OD-8 выполнен), Terms/Rules запрещают чужие изображения без согласия и несовершеннолетних, но требуемое **интерактивное** предупреждение в момент загрузки отсутствует (есть лишь пассивный i18n-хинт).

#### LEGAL-011 — [medium] Нет отдельного экрана/записи согласия на верификацию личности (Экран 5)
- **Требование:** согласие на верификацию личности (Экран 5) как отдельный шаг с обязательными чекбоксами; сохранять user ID, дату/время, версию, язык, источник, выбранный метод верификации, статус, action-id.
- **Цитата:** chat8_legal — Экран 5, л.1655, 1689-1714.
- **Где:** `src/app/[locale]/v2/verify/intro/page.tsx`, `verify/doc`, `verify/selfie` (согласия нет); `src/lib/telegram/bot/handlers.ts:413-449` (bio consent).
- **Что не так:** выделенного экрана/записи с чекбоксами нет. Identity/selfie-согласие свёрнуто в bot-«biometric» (bio:yes → recordConsent(['biometric'])). Но метод/статус/action-id не сохраняются, а экран с обязательными чекбоксами отсутствует.

#### LEGAL-013 — [medium] Отсутствует ряд обязательных регистрационных PDF
- **Требование:** регистрационные PDF MVP: User Agreement, Privacy Policy, Platform Rules ПЛЮС Data Storage & Deletion Policy; полный пакет также — PD-согласие, sensitive consent, photo consent, identity consent, Communication/Photo/Complaints rules — всё до запуска.
- **Цитата:** chat8_legal — п.24 л.836-852; п.3 л.5116-5126.
- **Где:** `public/legal/` (user-agreement.pdf, privacy.pdf, rules.pdf, pd-consent.pdf).
- **Что не так:** присутствуют только 4 PDF. ОТСУТСТВУЮТ: Data Storage & Deletion Policy, sensitive-consent, photo-consent, identity-consent, Communication Rules, Photo Rules, Complaints/Blocking Rules.

#### LEGAL-014 — [medium] Единая глобальная версия доков + нет ре-запроса согласия
- **Требование:** документы версионируются; при обновлении — повторный запрос согласия; записи согласия несут точную принятую версию.
- **Цитата:** chat8_legal — Экран 1 л.1126-1127, Экран 2 л.1261, Dev л.5296.
- **Где:** `src/content/legal.ts:22` (единая глобальная LEGAL_VERSION); `src/lib/telegram/bot/handlers.ts:247,262`; `supabase/migrations/20260601140000_hardening.sql:56-57`.
- **Что не так:** consent_version сохраняется и есть UNIQUE(user_id,consent_type,consent_version). Но ЕДИНАЯ глобальная `LEGAL_VERSION` для всех доков (все `LegalDoc.version` равны ей), и нет механизма ре-запроса согласия при изменении дока. Версия-на-записи выполнена; по-документное версионирование и триггер ре-согласия отсутствуют.

#### LEGAL-016 — [medium] Пруф согласия (IP/устройство/TG-ID) — фейковые константы
- **Требование:** пруф согласия должен включать IP/устройство/Telegram ID на момент согласия (+ user ID, версия, дата/время, язык, источник, action-id).
- **Цитата:** chat8_legal — п.31 л.968; Основная часть л.92-98.
- **Где:** `src/lib/telegram/bot/handlers.ts:246-256`.
- **Что не так:** колонки `ip` и `user_agent` есть, но заполняются хардкодом `ip='tg-webhook'`, `user_agent='telegram-bot'` — реальные IP/устройство/TG-ID на момент согласия не фиксируются. Telegram ID есть в `users`, но не привязывается к строке пруфа.

#### LEGAL-026 — [medium] Экспорт данных не логируется и не gate-ится по роли
- **Требование:** экспорт данных ограничен ролью (запрещён без роли); ВСЕ экспорты логируются, включая кто экспортировал.
- **Цитата:** chat8_legal — п.31 л.976; Dev л.5310; Analytics л.5397; Логи л.5350.
- **Где:** `src/app/api/account/route.ts:108-193`.
- **Что не так:** единственный экспорт — self-service экспорт данных пользователя (`account?action=export`), rate-limited через `claim_export_window`, но НЕ пишется в аудит и НЕ gate-ится по роли (user-scoped by design). Нет staff/admin bulk-export с ролевым гейтом и логированием; лога «кто экспортировал» не существует.

#### LEGAL-024 — [medium] Хранение/удаление не следует матрице по категориям
- **Требование:** хранение/удаление по матрице: профиль/фото удаляются-или-скрываются; селфи/доки минимально затем удаляются/обезличиваются после верификации; чаты удаляются/обезличиваются кроме споров; жалобы хранятся дольше; платежи по учётному закону; логи ограниченный период; результаты тестов удаляются при отзыве; данные матчинга обезличиваются.
- **Цитата:** chat8_legal — п.19 таблица хранения, л.618-647.
- **Где:** `supabase/migrations/20260620920000_split_window_and_jti_fixes.sql:54-96`.
- **Что не так:** `erase_user` применяет один единообразный немедленный delete+anonymize независимо от категории. Нет дифференцированного хранения: комментарии жалоб обнуляются (не хранятся-дольше-как-доказательство), нет пути хранения для платежей/учёта, нет отдельного окна минимального хранения селфи/доков (доки удаляются, остаются только SHA), данные матчинга (match_views) удаляются, а не обезличиваются.

#### LEGAL-018 — [low] Нет вью истории согласий в профиле
- **Требование:** приложение должно показывать историю согласий пользователя в разделе профиль/приватность.
- **Цитата:** chat8_legal — л.5283.
- **Где:** `src/app/[locale]/v2/anketa/privacy/page.tsx`, `v2/settings/page.tsx` (истории нет); `src/app/api/account/route.ts:129-132` (экспорт включает consents).
- **Что не так:** вью истории согласий в профиле/приватности/настройках нет. Согласия только выгружаются внутри JSON self-service экспорта, не показываются как экран истории.

#### LEGAL-021 — [low] Нет дисклеймера «Baxtlilar не несёт ответственности» в точке обмена контактами
- **Требование:** дисклеймер о добровольном обмене контактами перед чатом и при обмене контактами, что Baxtlilar не отвечает за off-platform обмен; может срабатывать при отправке телефона/TG в чате.
- **Цитата:** chat8_legal — Экран 10 л.2655-2658; таблица п.2 doc 17 л.114-117.
- **Где:** `src/app/api/chats/[id]/messages/route.ts:50` (анти-контакт фильтр); `src/content/legal.ts:375-376` (rules copy).
- **Что не так:** анти-контакт фильтр блокирует контакты в чате, дисклеймеры об off-platform ответственности ЕСТЬ в статичной копии (Terms §8, Offer §5), но эта копия НЕ выводится в точке входа в чат или обмена контактами. Нет экрана/баннера дисклеймера перед чатом.

#### LEGAL-028 — [high] Нет 2FA у персонала + нет гранулярной RBAC для документов/чатов/жалоб
- **Требование:** RBAC-гейт документов/селфи/чатов/жалоб (Verification Manager/International Manager/Super Admin; чат по case/complaint ID); 2FA у персонала; просмотр доков/селфи/жалоб/чатов логируется.
- **Цитата:** chat8_legal — Экран 5 л.1796-1806; п.31 л.972-980; Dev л.5304-5310; л.290.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:221` (roles); `src/app/api/admin/login/route.ts`; `admin_audit_log`; grep — 2fa/totp отсутствуют.
- **Что не так:** админ-роли только `superadmin` и `moderator` — не гранулярная RBAC. 2FA/TOTP нет нигде в кодовой базе. Есть частичное логирование (admin_audit_log + out-of-queue view logging). Отсутствуют: гранулярные роли и обязательная 2FA персонала. *(Примечание: гранулярность ролей частично покрыта OD-10 «1-2 модератора»; отсутствие 2FA — реальный непокрытый пробел.)*

> Примечание по правовому домену: спека-файлы `chat5_safety.md`/`chat8_legal` не входят в репозиторий, поэтому точные тексты копий берутся из требований находок, а не перечитываются из спеки.

### 2.2. Anketa (анкета) — 9 багов

#### ANK-05 — [medium] Отсутствуют residence_format и relocation_readiness (Экран 2)
- **Требование:** Экран 2 собирает residence_status, current/birth геополя, residence_format (with_family/independent/other), relocation_readiness (yes/no/open_to_discuss). Без точного адреса/геолокации.
- **Цитата:** chat2_anketa.md · Экран 2 (л.298-484, 698-751).
- **Где:** `src/components/v2/AnketaBirthPlaceForm.tsx:36-41`; `src/components/v2/AnketaBasicForm.tsx`; `src/lib/profile/schemas.ts:115-136,191-196`.
- **Что не так:** current-residence и birth-location собираются без адреса/геолокации (совместимая часть). НО `residence_format` и `relocation_readiness` не существуют нигде в коде (grep = 0). `residence_status` — только неявно через country_of_residence.

#### ANK-07 — [medium] Расхождения в education / activity_field / employment_format (Экран 3)
- **Требование:** Экран 3: bio, education_level (8 опций вкл. other + prefer_not_to_say), activity_field (18 сфер + activity_field_other при «other»), employment_format (full/partial/free-schedule/own-business/studying/home-family/temporarily-not-working/other).
- **Цитата:** chat2_anketa.md · Экран 3 (л.775-928, 1126-1199).
- **Где:** `src/components/v2/AnketaSelfForm.tsx:94-123`; `src/lib/profile/options.ts:53-61,204-231`.
- **Что не так:** (1) EDUCATION — 7 опций, нет отдельного «other» (есть `na`); (2) ACTIVITY_FIELDS — 17 сфер, не 18, и нет `activity_field_other` при «other»; (3) собираемый employment_format = office/remote/hybrid/own_business/not_working — это ось work-LOCATION, а не work-ARRANGEMENT из спеки. Enum EMPLOYMENT (arrangement) существует, но не используется формой.

#### ANK-08 — [medium] bio валидируется как 20-1000 СИМВОЛОВ, а не 30-250 СЛОВ
- **Требование:** bio обязательна для публикации; валидируется min 30 / max 250 СЛОВ; отклоняет телефоны, TG-юзернеймы, ссылки, хэндлы IG/TikTok/FB, рекламу, грубость.
- **Цитата:** chat2_anketa.md · Экран 3 (л.790-799, 1145-1162, 1038).
- **Где:** `src/lib/profile/schemas.ts:200-205`; `src/app/api/onboarding/profile/publish/route.ts:31-33`; `src/lib/profile/schemas.ts:70-90`.
- **Что не так:** bio обязательна ✓ и контакт-фильтр отклоняет телефоны/хэндлы/ссылки ✓. НО длина валидируется как 20-1000 СИМВОЛОВ (`schemas.ts:203-204`), а не 30-250 СЛОВ. Отклонение грубости/неуместного контента на вводе не реализовано (отдано реактивной модерации).

#### ANK-10 — [medium] Фото — общий загрузчик без типизированных слотов + несоответствие типа/размера
- **Требование:** Экран 4 — три типизированных слота (portrait, full_body, family), каждый JPG/PNG до 10MB, статусы модерации; проверка мин.качества и (где возможно) дубликатов/интернет-источника.
- **Цитата:** chat2_anketa.md · Экран 4 (л.1248-1386, 1630-1685).
- **Где:** `src/components/v2/AnketaPhotosForm.tsx:20-24`; `src/app/api/onboarding/profile/photo/route.ts:38-53`; `src/lib/uploads/storage.ts:9,89-102`; `supabase/migrations/20260531000000_init_schema.sql:106-118`.
- **Что не так:** общий загрузчик 1-3 фото без типизированных слотов (нет колонки photo_type/slot). Принимает JPEG/PNG/WebP/HEIC до 12MB (спека: JPG/PNG до 10MB). Нет проверки мин.качества/интернет-источника. *(Сильнее находки: sha256 для профильных фото НЕ вычисляется — только для документов, → дедуп фото невозможен.)* Enum статусов модерации совпадает.

#### ANK-16 — [medium] family_views[] не собирается нигде (Экран 6)
- **Требование:** Экран 6: top_life_values[] (1-3, cap), religion (7 опций + religion_other при other), religion_importance_level (1-5), family_views[] (мультивыбор из 5 карточек-утверждений).
- **Цитата:** chat2_anketa.md · Экран 6 (л.2121-2258, 2447-2496).
- **Где:** `src/components/v2/AnketaValuesForm.tsx:61-75`; `src/lib/profile/schemas.ts:237-242`; `src/lib/profile/options.ts:31-39,243-258`.
- **Что не так:** top_life_values 1-3 (cap) ✓; RELIGION 7 опций ✓ (но нет religion_other_text). religion_importance_level (1-5) заменён качественным religion_practice — **это intentional** (§1.12). РЕАЛЬНЫЙ ПРОБЕЛ: `family_views[]` (5 карточек) не собирается нигде; `extended.family.views` зарезервировано, но ни форма, ни роут его не пишут.

#### ANK-18 — [medium] Расхождения в предпочтениях партнёра (Экран 8)
- **Требование:** Экран 8: partner_age_min/max (≥18), partner_height_preference (6 опций вкл. not_important), partner_religion_preference (6 опций), partner_top_qualities[] (до 3, cap), partner_location_preference (same_city/ready_to_move/not_important).
- **Цитата:** chat2_anketa.md · Экран 8 (л.2911-3072, 3250-3307).
- **Где:** `src/components/v2/AnketaPartnerExtendedForm.tsx:62-67,103-104,160-184`; `src/lib/profile/schemas.ts:256-281`.
- **Что не так:** partner_age_min ≥18 ✓. (1) partner_top_qualities capped max 5, не 3; (2) height — числовой min/max диапазон, а не 6-опционный выбор с not_important; (3) partner_religion_match — 3 опции, не 6; (4) partner_location_preference отсутствует (комментарий «TBD Sprint 3»).

#### ANK-24 — [medium] Собирается только post_marriage_living; 4 поля будущей семьи не собираются (Экран 12)
- **Требование:** Экран 12: future_living_format (6 опций), relocation_after_marriage_readiness, separate_from_parents_importance, future_home_location_preference, living_conditions_notes.
- **Цитата:** chat2_anketa.md · Экран 12 (л.5452-5501).
- **Где:** `src/components/v2/AnketaMarriageForm.tsx:30,56`; `src/lib/profile/schemas.ts:316-321`; `src/lib/profile/options.ts:176-197`.
- **Что не так:** форма «marriage» отправляет только `post_marriage_living` (4 опции, не 6). `separate_from_parents_importance` есть в `futureFamilySchema`, но не импортируется ни одним роутом/формой; relocation_after_marriage_readiness / future_home_location_preference / living_conditions_notes отсутствуют в коде полностью.

#### ANK-01 — [low] height/weight — числовой ввод, а не линейка; bmi отсутствует
- **Требование:** Экран 1: display_name, gender, languages[], height_cm через линейку/ruler (без свободного ввода), weight_kg через линейку, авто-bmi.
- **Цитата:** chat2_anketa.md · Экран 1 (л.21-116, 222-262).
- **Где:** `src/components/v2/AnketaAppearanceForm.tsx:86`; `src/lib/profile/schemas.ts:139-146`; `src/lib/profile/options.ts:117-129`.
- **Что не так:** height_cm/weight_kg — числовой `TextInput`, а не линейка (спека прямо: «без свободного ввода»). `bmi` не существует нигде (нет колонки, нет вычисления). Декомпозиция basic/appearance приемлема.

#### ANK-29 — [low] Глобальный дефолт видимости профиля = 'public' вместо verified_only
- **Требование:** экран приватности (16): жёсткие non-overridable правила; рекомендованные дефолты, включая profile_visibility_mode = visible_to_verified_users.
- **Цитата:** chat2_anketa.md · Экран 16 (л.7602-7651).
- **Где:** `src/components/v2/AnketaPrivacyForm.tsx:26`; `supabase/migrations/20260629000000_anketa_v3_hybrid.sql:53`.
- **Что не так:** жёсткие поля (trusted_person/documents/phone/telegram/myid/health) удовлетворены отсутствием (нигде не выводятся). НО экран приватности предлагает единый глобальный `profile_visibility_mode` с DEFAULT `'public'`, тогда как спека рекомендует `visible_to_verified_users` (verified_only). По-блочная структура дефолтов не смоделирована.

### 2.3. System (стейт-машина / enum) — 11 багов

#### SYS-004 — [medium] Нет валидации матрицы переходов lifecycle_state
- **Требование:** переходы lifecycle_state ограничены заданной матрицей; deleted — терминальный (нет исходящих).
- **Цитата:** chat13_system.md §1.2.
- **Где:** `src/lib/state-machine/transitions.ts:59-66`; `supabase/migrations/20260601140000_hardening.sql:30-39`; `supabase/migrations/20260619500001_admin_oversight_fixes.sql:203`.
- **Что не так:** матрица переходов lifecycle_state НЕ энфорсится. TS-гард валидирует только `onboarding_step`. RPC `transition_user` слепо coalesce-ит lifecycle_state из патча без проверки from→to; нет DB-триггера/CHECK. Нелегальные рёбра (deleted→active, blocked→paused) проходят. Единственный гард — отклонение таргетов blocked/pending_ban.

#### SYS-007 — [medium] Нет 30d-purge сырого телефона для незавершённых регистраций
- **Требование:** handoff_pending вычисляется; при bot→miniapp интервале >7d → bot_completed_stale; сырой телефон удаляется через 30d для незавершённых регистраций.
- **Цитата:** chat13_system.md §1.3 (л.57).
- **Где:** `src/app/api/cron/housekeeping/route.ts:33-59`.
- **Что не так:** нет onboarding_step `bot_completed_stale` и нет 7-дневного stale-перехода. Housekeeping cron запускает только `gc_start_token_uses` и `admin_sla_reclaim_stale_cases`; НЕТ джобы очистки `phone_number` через 30 дней для незавершённых регистраций. Право-на-забвение 30d-purge для брошенного онбординга отсутствует (OD-11 — решённое требование, оставлено нереализованным).

#### SYS-021 — [medium] Нет 4-уровневой видимости чувствительных полей + нет отдельного согласия
- **Требование:** чувствительные поля (health/drugs) поддерживают уровни видимости {hidden, after_mutual, by_consent, matching_safety_only}, gate-ятся явным согласием.
- **Цитата:** chat13_system.md §1.12 (л.142) + §3.5 (RU-14).
- **Где:** `src/lib/profile/schemas.ts:303,410`; `src/components/v2/AnketaLifestyleForm.tsx:25-30`; `src/app/api/onboarding/profile/lifestyle/route.ts:15`.
- **Что не так:** чувствительные поля собираются и скрыты до mutual, но только как единое бинарное «скрыть до mutual». НЕТ 4-уровневого enum видимости и НЕТ отдельного согласия (пишутся только terms/privacy/offer/pd/rules + biometric). RU-14 (whitelisted) требует градацию уровней и отдельное согласие — обе отсутствуют.

#### SYS-033 — [medium] Не реализована блокировка женатых (OD-12) + нет отдельного согласия на чувствительные ПД
- **Требование:** состав согласий вкл. отдельное согласие на чувствительные данные; возраст hard-gate 18+; женатые пользователи блокируются с уважительным предупреждением.
- **Цитата:** chat13_system.md §3.5 OD-4 / OD-5 / OD-12.
- **Где:** `src/lib/telegram/bot/handlers.ts:387-421`; `src/lib/profile/schemas.ts:110`; `src/lib/profile/options.ts:9-14`.
- **Что не так:** 18+ hard-gate ЕСТЬ ✓, bundle согласий записывается (OD-4 whitelisted). НО: (1) отдельное согласие на чувствительные ПД не записывается (см. SYS-021); (2) OD-12 блокировка женатых НЕ реализована — MARITAL_STATUS = never/divorced/widowed/other (нет значения `married` и нет гейта-блокировки). Женатый выбирает «other» и проходит. OD-12 — решённое требование, оставлено нереализованным.

#### SYS-003 — [low] lifecycle_state содержит 6-е значение 'pending_ban' сверх точного набора из 5
- **Требование:** lifecycle_state — enum РОВНО из {onboarding, active, paused, blocked, deleted}.
- **Цитата:** chat13_system.md §1.2.
- **Где:** `src/lib/state-machine/types.ts:7`; `supabase/migrations/20260619500000_admin_oversight.sql:12`.
- **Что не так:** добавлено 6-е значение `pending_ban` (two-admin ban, Option A), присутствует в БД (колонка pending_ban_at + RPC). Не входит в точный набор из 5 и НЕ whitelisted ни одним OD/known_deviation. *(Асимметрия: tutorial/ready-дополнения onboarding_step whitelisted, а это lifecycle-дополнение — нет.)*

#### SYS-009 — [low] verification_status содержит Stage-2 значение 'revoked'
- **Требование:** verification_status MVP {not_started..approved,rejected}; revoked = Этап 2, НЕ должен присутствовать в MVP.
- **Цитата:** chat13_system.md §1.4.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:12-15`; `src/lib/state-machine/types.ts:64-73`.
- **Что не так:** enum (DDL и TS) включает `revoked` (спека: Этап-2, «MUST NOT be present in MVP»). Не whitelisted. Значение определено, но не пишется ни одним MVP-флоу (low, т.к. недостижимо).

#### SYS-010 — [low] profile_completion содержит Stage-2 'pending_remoderation'
- **Требование:** profile_completion {not_started,in_progress,completed}; pending_remoderation = Этап 2, исключён из MVP.
- **Цитата:** chat13_system.md §1.5.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:16`; `src/lib/state-machine/types.ts:75`.
- **Что не так:** enum включает `pending_remoderation`, исключённый из MVP. Не whitelisted.

#### SYS-011 — [low] profile_status содержит Stage-2 'hidden'
- **Требование:** profile-moderation status MVP {draft,under_review,needs_changes,approved,published,rejected}; hidden = Этап 2, MUST NOT быть MVP-значением.
- **Цитата:** chat13_system.md §1.6.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:20`.
- **Что не так:** enum включает `hidden` (Этап-2). Не whitelisted. Все MVP-значения присутствуют; лишнее — `hidden`.

#### SYS-012 — [low] photo_status содержит Stage-2 'hidden_by_user'
- **Требование:** photo_status MVP {uploaded,under_review,approved,needs_replacement,rejected}; hidden_by_user = Этап 2.
- **Цитата:** chat13_system.md §1.7 (вкл. л.95).
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:19`.
- **Что не так:** enum включает `hidden_by_user` (Этап-2). Не whitelisted. *(Покрытие 7 категорий reject-reason в этом проходе не проверялось.)*

#### SYS-014 — [low] complaint_status содержит Stage-2 значения (достижимые!)
- **Требование:** complaint status MVP {new,in_progress,confirmed,not_confirmed,action_taken,closed}; requires_clarification и escalated = Этап 2, исключены.
- **Цитата:** chat13_system.md §1.9.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:21`.
- **Что не так:** enum включает `requires_clarification` и `escalated` (оба Этап-2). Не whitelisted. **Сильнее прочих SYS-enum-багов:** эти значения РЕАЛЬНО достижимы — `src/app/api/admin/reports/[id]/decision/route.ts:10` включает `escalated` в ALLOWED (модератор может выставить), и UI фильтрует по обоим. Достижимое Stage-2 состояние, не просто спящее значение.

#### SYS-015 — [low] sanction_level содержит 4 Stage-2 soft-ограничения
- **Требование:** restriction level MVP {none,warning,temp_block,perm_block}; soft-ограничения = Этап 2, исключены; perm_block выставляется только super-admin.
- **Цитата:** chat13_system.md §1.10.
- **Где:** `supabase/migrations/20260531000000_init_schema.sql:23`.
- **Что не так:** enum включает 4 Этап-2 soft-ограничения {interest_limited, chat_limited, hidden_from_recommendations, re_verification}. Не whitelisted. *(perm_block super-admin-гейт в этом проходе отдельно не подтверждён.)*

### 2.4. Safety (безопасность) — 5 багов

#### SAF-013 — [medium] Нет Safety Center «Жалобы и блокировки» + нет списка заблокированных
- **Требование:** Safety Center выставляет «Жалобы и блокировки» первым/самым доступным пунктом: пожаловаться на профиль, пожаловаться на сообщение/чат, заблокировать, СМОТРЕТЬ ЗАБЛОКИРОВАННЫХ, смотреть ограничения аккаунта.
- **Цитата:** chat5_safety.md §«Жалобы и блокировки» л.2126-2143.
- **Где:** `src/app/[locale]/v2/settings/page.tsx:50-101`; `src/app/api/block/route.ts` (нет GET).
- **Что не так:** консолидированного Safety Center нет. V2 settings содержит только self-summary + pause/resume/delete + версию; нет пункта «Жалобы и блокировки». Report/Block есть ТОЛЬКО на странице профиля. НЕТ списка заблокированных (у block-роута нет GET) и НЕТ вью ограничений аккаунта. Не покрыто ledger'ом (Stage-2 deferrals перечислены исчерпывающе, этого нет).

#### SAF-009 — [low] После жалобы не показывается гарантия анонимности
- **Требование:** репортёр остаётся анонимным; после жалобы пользователь должен видеть: «Спасибо. Мы получили вашу жалобу и проверим ситуацию. Ваша личность не будет раскрыта другому пользователю.»
- **Цитата:** chat5_safety.md §9.2 л.893-898; §19.2; §7 л.716-717.
- **Где:** `messages/ru.json:474,775`; `src/components/v2/ProfileSafetyActions.tsx:51`.
- **Что не так:** анонимность структурно гарантирована (reporter_id не раскрывается), но копия подтверждения — «Спасибо, жалоба отправлена» / «Жалоба отправлена» — РОНЯЕТ явное предложение-гарантию анонимности. Дискриминатор: block-флоу несёт аналогичную реассуранс-копию («не узнает об этом»), т.е. реассуранс намеренно опущен именно в report-пути.

#### SAF-015 — [low] Попытки отправить контакты блокируются, но НЕ логируются
- **Требование:** система блокирует передачу контактов в сообщениях чата и cover-сообщениях интереса; попытки отправить контакты ЛОГИРУЮТСЯ.
- **Цитата:** chat5_safety.md §8.3 л.751-769; §28 «попытки отправить контакты» л.2022.
- **Где:** `src/app/api/interest/route.ts:32-33`; `src/app/api/chats/[id]/messages/route.ts:51-52`.
- **Что не так:** блокировка выполнена (400 contact_blocked). ЛОГИРОВАНИЕ не реализовано — ни один роут не пишет запись о заблокированной попытке; в аудит-инфраструктуре нет sink для contact-attempt. Требование §28 не выполнено.

#### SAF-016 — [low] Pre-chat предупреждение неполно (нет адреса/документов/работы)
- **Требование:** перед первым сообщением чата пользователь видит предупреждение против передачи телефона, адреса, документов, места работы до достаточного доверия (конкретная копия).
- **Цитата:** chat5_safety.md §8.4 л.782-792; §19.1.
- **Где:** `src/components/v2/ChatRoom.tsx:298-314`; `messages/ru.json:507`.
- **Что не так:** механизм ЕСТЬ (пустой чат → `safety_tip_extended`). Но копия роняет упоминание адреса, документов, места работы и строку «Baxtlilar не требует раскрывать личные контакты». Полная строка `safety_tip` (упоминает адрес) — мёртвый код, не рендерится. Предупреждение показано вовремя, но формулировка урезана.

#### SAF-022 — [low] Частичное аудит-логирование безопасных действий (блокировки/жалобы не логируются)
- **Требование:** система логирует безопасность-значимые действия: изменения профиля, приватности, жалобы, решения модератора, блокировки, попытки gift/trusted-person/отправки контактов, ре-верификации.
- **Цитата:** chat5_safety.md §28 л.2009-2023; §20.
- **Где:** `src/lib/admin/guard.ts:40-60`; `src/lib/state-machine/transitions.ts:44`; `src/app/api/report/route.ts`; `src/app/api/block/route.ts`.
- **Что не так:** частично. Решения модератора (adminAudit) и state-transitions логируются. НО жалобы (reports.insert), блокировки (blocks.upsert), попытки отправки контактов НЕ пишутся в аудит. Пробел частичного покрытия. *(Логирование изменений профиля/приватности отдельно не проверялось, но подтверждённых пробелов достаточно, чтобы требование считать невыполненным.)*

---

## 2A. Заявлены как real_bug, не прошли верификацию — требуют подтверждения

Эти находки помечены `bucket=real_bug`, но НЕ прошли финальную верификацию (`verified=false`, нет `confirmed`). Строго они не входят в раздел 2, но их нельзя молча ронять — особенно один high.

| ID | Sev | Кратко | Где |
|---|---|---|---|
| **ADM-VER-014** | **high** | Просмотр паспорта/селфи в админке мятит signed URL **без запроса причины и без записи в аудит**; отдельного download-permission нет | `src/lib/admin/load-case.ts:27-33,60-69` |
| ADM-BAN-028 | medium | unban не требует причину и НЕ уведомляет пользователя (асимметрия с ban-confirm) | `src/app/api/admin/users/[id]/unban/route.ts:10-51` |
| ADM-VER-005 | low | В чек-листе перед approve нет обязательного комментария и пунктов «документ читаем»/«срок валиден» | `src/components/admin-ops/case/DecisionPanel.tsx:162-236` |
| ADM-VER-011 | low | Просроченный документ — только soft-warn, нет отдельного reason-template «документ просрочен» | `src/lib/admin/passport-validation.ts:112-119` |
| ADM-CLI-018 | low | В директории клиентов нет фильтров по verification-state, тарифу, стране | `src/lib/admin/load-clients-search.ts:42-102` |
| ADM-PHO-023 | low | В аудите решения по фото не фиксируется old_status (только new) | `src/app/api/admin/photos/[id]/decision/route.ts:66-74` |

> **ADM-VER-014** — единственный high вне legal. Просмотр биометрии/документов без аудит-следа — прямой комплаенс-риск (пересекается по духу с LEGAL-028). Рекомендуется подтвердить и завести в P1.

---

## 3. Намеренные отклонения (`intentional_deviation`)

Это НЕ баги — осознанные решения учредителя/архитектуры, покрытые ledger'ом. Приведены для полноты (чтобы аудитор не перепутал их с дефектами).

| ID | Отклонение | OD-ссылка |
|---|---|---|
| ONB-01 | 3-экранная editorial-серия свёрнута в один branded welcome | founder_amendment BOT↔MINI APP + RU-1 |
| ONB-02 | Согласие на серьёзность намерений — в bot до PD, не чекбоксом на welcome | OD-4 + BOT↔MINI APP split |
| ONB-03/04/05 | Экраны trust/rules свёрнуты; правила через PDF в bot-согласии | OD-4 + RU-1 + BOT↔MINI APP |
| ONB-06 | Нет Screen-5 residence-status гейта (verified=true, но confirmed=false) | RU-1/RU-18/OD-15 — спека-canonical, не баг |
| ONB-10 | Онбординг стартует в TG-боте; нет отдельного «Вход через Telegram» | BOT↔MINI APP split |
| ONB-11 | Копия 'legal' — dead key; связывающее согласие в bot | OD-4 + BOT↔MINI APP |
| ONB-12 | Телефон через TG contact share (request_contact) — это и есть новый дизайн | OD-3 / OTP→TG contact share |
| ONB-14/21/22/23/24/30 | Bot-флоу линейный чат, а не дискретные web success/wait-экраны; Shadow Active | known_deviations #1/#4 |
| ONB-29 | Источники attribution по альтернативной внутренней спеке (MAJOR #3); скипается корректно (confirmed=false) | — |
| ANK-04 | Нет OneID/MyID; gender — свободный enum | OD-15 |
| ANK-11 | Семейное фото не обязательно | OD-8 |
| ANK-30 | Completeness-gate принимает under_review фото (реактивная модерация) | OD-14 |
| MATCH-* | Match of the Day (одна рекомендация), качественный match story без %, прогрессивное раскрытие | matching pivot 2026-06-25 |
| SAF-023 | Плоские лимиты 5 интересов/30 просмотров, не per-plan | OD-6 + tariff amendment |
| LEGAL-001/002/004 | Согласие в bot одним combined-accept, а не 3 чекбокса/отдельный PD-экран | OD-4 |
| LEGAL-012 | Селфи = биометрия, отдельная «biometric» категория | OD-2 |
| LEGAL-017 | Отзыв согласия — через поддержку, не встроенная форма | OD-4 |
| LEGAL-032 | verification_status соответствует; OneID/MyID отложен | OD-15 |
| LEGAL-033 | Per-photo visibility-level отложен (verified=true, confirmed=false); after-mutual reveal функционально есть | Stage-2 (migration comment) |
| SYS-005/008 | Реворк onboarding_step, BOT↔MINIAPP split, TG-native consent-bundling; HMAC initData + session_id | founder_amendment + OD-4 |
| SYS-032 | Телефон через TG contact share; legacy SMS/OTP enum — только placeholders | OD-3 |

---

## 4. Ещё не построено (`not_yet_built`) — roadmap-пробелы

Есть в спеке, но осознанно отложено (часть — Stage-2 по ledger'у, часть — просто ещё не построено).

**Онбординг / верификация:**
- ONB-07/08/09/16/17/18 (medium/low) — нет residence-branch верификации и OneID/MyID; у всех единый ручной passport+selfie путь. *(OD-15: OneID/MyID = Stage 2, MVP fallback.)*
- ONB-13 (low) — нет альтернативного метода подтверждения телефона при сбое (Eskiz за флагом).

**Анкета:**
- ANK-02 (low) — BMI не реализован вообще.
- ANK-06/09 (low) — нет по-полевых visibility-тогглов (birth_region/education/activity/employment).
- ANK-12 (low) — нет per-photo visibility (слотов нет).
- ANK-23 (medium) — Экран 11 (родители) отсутствует целиком.
- ANK-25 (medium) — Экран 13 (здоровье) отсутствует целиком.
- ANK-27/28 (medium/low) — Экран 14 (география) отсутствует.

**Безопасность:**
- SAF-018 (medium) — нет автоматической эскалационной лестницы санкций. *(status_map §1.10 Stage 2; OD-10.)*
- SAF-019 (medium) — restriction sub-статусы (interest_limited/chat_limited/...) не энфорсятся. *(Stage 2.)*
- SAF-026 (medium) — нет авто-ре-верификации при изменении identity-полей / накоплении жалоб. *(revoked = Stage 2.)*

**Админ:**
- ADM-VER-013 (medium) — нет выделенной роли Identity Manager (только superadmin/moderator; F-120 in-queue scope как замена).
- ADM-QUE-017 (medium) — нет «просрочка SLA» индикатора на таймлайне (SLA pills отложены на Sprint 3).

**Система / аналитика / монетизация / правовое:**
- SYS-018 (low) — монетизация (тарифы/подписки/платежи/boost/gift) не построена. *(RU-12: не запускать без terms/refunds/logs.)*
- SYS-022/024/025/027 (medium/low) — North Star метрика, funnel-события snake_case, §2.4 формулы, per-role дашборды — аналитика отложена (Sprint 2-4).
- SYS-030 (low) — design tokens только как CSS-переменные; нет Figma Variables/JSON, atomic-библиотеки, light/dark темы.
- SYS-035 (low) — только ru/uz; EN/TR не добавлены. *(known_deviation: локализация в очереди, RU-13 в силе.)*
- LEGAL-019/020 (medium/low) — нет pre-first-chat acknowledgement экрана и его записи.

---

## 5. План фиксов (приоритизированный)

Пункты сгруппированы по корневой причине (несколько багов чинятся одним изменением). Приоритеты: P0 (critical) → P3 (low).

### P0 — Правовое основание для чувствительных ПД (блокер запуска)
1. **Отдельное согласие на чувствительные/специальные ПД (C6).** Ввести отдельный экран согласия в Mini App перед сбором finance/lifestyle/health, записывать в `consents` тип `sensitive` со списком категорий. **Чинит:** LEGAL-006, LEGAL-007, LEGAL-008 (critical), и sensitive-consent-часть SYS-021, SYS-033. *Где:* новый экран в `src/app/[locale]/v2/anketa/*`; `src/lib/telegram/bot/handlers.ts` / новый роут; `recordConsent`. *Объём: L (экран + роут + миграция enum consent_type + правовая копия с юристом).*
2. **Юридическая верификация правовой копии.** Вся копия помечена DRAFT/requires-lawyer (`legal.ts:3-6`) — снять флаг после ревью юриста. *Объём: внешний (юрист) + S на снятие флага.*

### P1 — Целостность и аудит согласий/доступа
3. **Схема таблицы `consents`: добавить колонки status (active/withdrawn/outdated), source, technical action-id.** **Чинит:** LEGAL-003, LEGAL-005 (high), LEGAL-015 (high, enum-часть), LEGAL-016 (реальный IP/устройство/TG-ID вместо констант). *Где:* новая миграция поверх `20260531000000_init_schema.sql:54-61`; `handlers.ts:246-268`. *Объём: M.*
4. **Админ-вью правового статуса пользователя** по каждому типу согласия. **Чинит:** LEGAL-015 (admin-часть), частично LEGAL-018. *Где:* новая страница `src/app/admin/*`. *Объём: M.*
5. **Аудит просмотра/скачивания документов + запрос причины.** Логировать каждый минт signed URL паспорта/селфи с причиной; ввести отдельный download-permission. **Чинит:** ADM-VER-014 (high, требует подтверждения). *Где:* `src/lib/admin/load-case.ts:27-33,60-69`. *Объём: M.*
6. **2FA/TOTP для персонала.** **Чинит:** LEGAL-028 (2FA-половина). *Где:* `src/app/api/admin/login/route.ts` + схема admin_users. *Объём: L.*
7. **Матрица хранения при удалении.** Разбить `erase_user` на категории (delete-immediately / anonymize / retain-for-payments / retain-for-complaints / legal-disputes). **Чинит:** LEGAL-023 (high), LEGAL-024. *Где:* `supabase/migrations/*` (переписать `erase_user`, `20260620920000:54-96`). *Объём: L.*
8. **Валидация матрицы переходов lifecycle_state** (deleted терминальный). **Чинит:** SYS-004. *Где:* RPC `transition_user` (`20260619500001:203`, `20260601140000:31`) + опц. DB CHECK/триггер. *Объём: M.*
9. **30d-purge сырого телефона + 7d stale-переход** для незавершённых регистраций. **Чинит:** SYS-007. *Где:* `src/app/api/cron/housekeeping/route.ts` + новая RPC. *Объём: M.*

### P2 — Функциональные пробелы анкеты и безопасности
10. **Блокировка женатых (OD-12)** с уважительным предупреждением: добавить значение `married` в MARITAL_STATUS + гейт. **Чинит:** SYS-033 (married-часть). *Где:* `src/lib/profile/options.ts:9-14` + гейт публикации/анкеты. *Объём: S.*
11. **bio: валидировать 30-250 слов, а не 20-1000 символов.** **Чинит:** ANK-08. *Где:* `src/lib/profile/schemas.ts:200-205` + `AnketaSelfForm.tsx:72-73`. *Объём: S.*
12. **Недостающие поля анкеты:** residence_format/relocation_readiness (ANK-05), family_views[] (ANK-16), поля будущей семьи (ANK-24), исправить education/activity/employment оси (ANK-07), partner-предпочтения (ANK-18). *Где:* соответствующие `src/components/v2/Anketa*Form.tsx` + `schemas.ts` + `options.ts`. *Объём: L (пакет полей).*
13. **Фото: типизированные слоты (portrait/full_body/family) + ограничить типы JPG/PNG до 10MB + вычислять sha256.** **Чинит:** ANK-10. *Где:* `AnketaPhotosForm.tsx`, `storage.ts:9,89-102`, миграция `profile_photos`. *Объём: M.*
14. **Safety Center «Жалобы и блокировки»** первым пунктом: список заблокированных (добавить GET в block-роут), пункты report/block, вью ограничений. **Чинит:** SAF-013. *Где:* `src/app/[locale]/v2/settings/page.tsx`, `src/app/api/block/route.ts`. *Объём: M.*
15. **Логирование заблокированных попыток отправки контактов + аудит блокировок/жалоб.** **Чинит:** SAF-015, SAF-022. *Где:* `interest/route.ts`, `chats/[id]/messages/route.ts`, `report/route.ts`, `block/route.ts` + новый sink. *Объём: M.*
16. **unban: требовать причину + уведомлять пользователя.** **Чинит:** ADM-BAN-028 (требует подтверждения). *Где:* `src/app/api/admin/users/[id]/unban/route.ts`. *Объём: S.*
17. **Недостающие регистрационные PDF** (Data Storage & Deletion Policy и др.). **Чинит:** LEGAL-013. *Объём: внешний (юрист) + S на подключение.*

### P3 — Копия, дефолты, чистка enum
18. **Копия-фиксы:** гарантия анонимности после жалобы (SAF-009), полное pre-chat предупреждение с адресом/документами/работой — включить `safety_tip` вместо урезанного `safety_tip_extended` (SAF-016). *Где:* `messages/ru.json:474,507,775`, `ChatRoom.tsx:312`. *Объём: S.*
19. **Дефолт видимости профиля → verified_only** вместо public. **Чинит:** ANK-29. *Где:* `20260629000000_anketa_v3_hybrid.sql:53`, `AnketaPrivacyForm.tsx:26`. *Объём: S.*
20. **Одна миграция-чистка Stage-2 значений из enum** (revoked, pending_remoderation, hidden, hidden_by_user, requires_clarification/escalated, 4 soft-sanction, pending_ban). **Чинит:** SYS-003, SYS-009, SYS-010, SYS-011, SYS-012, SYS-014, SYS-015. *Внимание:* SYS-014 (escalated/requires_clarification) достижимы через ADMIN ALLOWED, поэтому либо убрать значения, либо явно whitelist'нуть в ledger. *Где:* новая миграция + `types.ts` + `decision/route.ts:10`. *Объём: M.*
21. **Прочее правовое:** интерактивное предупреждение о фото третьих лиц/семьи при загрузке (LEGAL-010), дисклеймер об off-platform ответственности в точке чата/обмена контактами (LEGAL-021), по-документное версионирование + ре-запрос согласия (LEGAL-014), вью истории согласий в профиле (LEGAL-018), логирование/ролевой гейт self-export (LEGAL-026). *Объём: пакет S-M.*
22. **Прочее админ (требует подтверждения):** чек-лист перед approve — обязательный комментарий + пункты «документ читаем»/«срок валиден» (ADM-VER-005), reason-template «документ просрочен» (ADM-VER-011), old_status в аудите фото (ADM-PHO-023), фильтры директории клиентов (ADM-CLI-018). *Объём: пакет S.*

---

*Основа: 176 находок по 6 доменам; 43 подтверждённых real bug, 6 непроверенных real_bug (включая 1 high — ADM-VER-014), 22 намеренных отклонения, 26 отложенных. Критический риск сосредоточен в правовом контуре согласий. Полный markdown также сохранён: `/private/tmp/claude-501/-Users-fayzullohoja-Desktop/fbca3beb-bb2b-47bb-b46d-8f94e1360cf5/scratchpad/audit_report.md`.*