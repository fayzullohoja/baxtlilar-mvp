# Анкета V3 — План реализации спеки от продактов

> **Источник:** `Чат 2 — Анкета.docx` (8940 строк, 20 экранов).
> **Дата:** 2026-06-29.
> **Связано:** Чат 3 (Matching), Чат 7 (Admin Panel), Чат 8 (Legal), Чат 10 (Analytics).

## TL;DR

Спека требует **анкету из 16 экранов сбора + 4 системных = 20 экранов**, со **~150 полями** в БД. Текущая V2-extended анкета — **8 экранов с ~30 полями**. Это полная переделка, не доработка.

Реалистичный объём: **4-5 sprint'ов по 1.5-2 недели**. Прежде чем кодить — нужны ответы учредителя на 8 продуктовых вопросов (см. §6) — иначе риск делать не туда.

---

## 1. Полная структура анкеты по спеке

### Экраны сбора данных (16)

| # | Экран | Что собирает |
|---|---|---|
| 1 | **Основная информация** | display_name + official_name (из OneID/MyID), gender (verified), birth_date, languages[], height_cm, weight_kg, **ИМТ** (автоматически, private_only) |
| 2 | **Текущее проживание** | residence_status (in_uz/abroad), current_country/region/city/district + **birth_country/region/district/city** (родной регион — отдельно!) + birth_region_visibility (3 уровня) + residence_format (с семьёй/самостоятельно) + relocation_readiness |
| 3 | **О себе** | bio (30-250 слов, модерация на контакты/спам) + education_level + activity_field (17 вариантов) + employment_format |
| 4 | **Фотографии профиля** | 3 фото обязательно (см. отдельную спеку про форматы) |
| 5 | **О семье и детях** | marital_status + has_children + children_count + children_age_text + future_children_plan + family_children_visibility |
| 6 | **Ценности и вера** | top_life_values[] (1-3) + religion + religion_importance_level (1-5) + family_views[] (5 опций) + 3 visibility поля |
| 7 | **Семейная модель** | family_role_model (traditional/equal/flexible) + wife_work_after_marriage_view + family_decision_model + household_responsibility_model |
| 8 | **Ожидания от партнёра** | partner_age_min/max + partner_height_preference (6 диапазонов) + partner_religion_preference + partner_top_qualities[] + partner_location_preference |
| 9 | **Финансы и материальная стабильность** | monthly_income_range (5 диапазонов в сумах) + income_stability_status + financial_obligations_status + financial_stability_importance (1-5) + family_finance_management_model + financial_priorities[] |
| 10 | **Образ жизни и привычки** | lifestyle_type + free_time_interests[] (12 опций) + daily_rhythm + bad_habits_status + nutrition_type + alcohol_attitude + drug_use_status |
| 11 | **Родители и семейная среда** | father/mother отдельно: status (alive/deceased) + age_range + activity_type + work_status. Плюс parents_marital_status + parents_opinion_importance + early_family_introduction_readiness |
| 12 | **Будущая семья и формат проживания** | future_living_format (6 опций) + relocation_after_marriage_readiness + separate_from_parents_importance + future_home_location_preference |
| 13 | **Здоровье и особенности** | general_health_status + physical_activity_level + chronic_health_conditions_status + family_life_health_impact_status |
| 14 | **География и предпочтения по месту проживания** | future_location_preference + preferred_countries[] + relocation_for_family_readiness + family_proximity_importance |
| 15 | **Доверенное лицо** ⭐ | trusted_person_enabled + last_name + first_name + relation (9 опций: мать/отец/брат/сестра/дядя/тётя/...) + country/city + phone + secondary_phone + email + contact_permission (3 уровня) |
| 16 | **Приватность и видимость** | profile_visibility_mode + profile_search_visibility + 8 блочных visibility (basic/education/family/values/living/health/trusted/photos) |

### Системные экраны (4)

| # | Экран | Назначение |
|---|---|---|
| 17 | **Предпросмотр анкеты** | Итог + список скрытых разделов + редактирование по блокам |
| 18 | **Проверка и подтверждение** | Сводка статусов: identity/birth_date/phone/photo/profile_data/document |
| 19 | **Отправлена на проверку** | ETA, очередь, выбор канала уведомления |
| 20 | **Опубликована / 20C Отклонена / 20D Скрыта** | Терминальные экраны |

---

## 2. Что у нас уже есть vs нужно

### Совпадает с текущим V2 extended (используем)

| Спека | Наш текущий field | Действие |
|---|---|---|
| display_name | display_name | ОК |
| gender | gender | ОК |
| birth_date | birth_date | ОК |
| languages[] | languages | ОК (но переименование с "spoken_languages") |
| height_cm | height_cm | ОК |
| weight_kg | weight_kg | ОК |
| current_country | country_of_residence | rename |
| current_region | region | ОК |
| current_city | city | ОК |
| residence_format | post_marriage_living | **другое поле!** наш про брак, спека про текущее проживание |
| bio | bio | ОК |
| education_level | education | rename |
| activity_field | employment | rename + новые опции |
| marital_status | marital_status | ОК |
| has_children | has_children | ОК |
| future_children_plan | children_plan | rename |
| religion | religion | ОК |
| religion_importance_level | religion_practice (4 опции) | **спека хочет шкалу 1-5 обратно**, а мы убрали! |
| family_views[] | values | rename + ограничить 5 опциями spec |
| partner_age_min/max | partner_age_min/max | ОК |
| partner_religion_preference | religion_partner_match (3 опции) | rename + расширить до 6 опций спека |

### Новое в спеке — нет у нас (~120 полей)

**Identity (Экран 1):**
- official_name, gender_verified_source, bmi (computed), bmi_visibility

**Geography (Экран 2):**
- residence_status, current_district, birth_country, birth_region, birth_district, birth_city, birth_region_visibility, location_visibility_mode, relocation_readiness

**Bio (Экран 3):**
- bio_word_count, bio_moderation_status, activity_field_other, education_visibility, activity_visibility, employment_visibility

**Family (Экран 5):**
- children_count, children_age_text, children_age_ranges[], family_children_visibility

**Values (Экран 6):**
- top_life_values[] (≠ наш values), family_views[] (5 опций спеки), values_visibility, religion_visibility, family_views_visibility

**Семейная модель (Экран 7) — ВСЁ НОВОЕ:**
- family_role_model, wife_work_after_marriage_view, family_decision_model, household_responsibility_model, family_model_visibility

**Ожидания (Экран 8):**
- partner_height_preference, partner_top_qualities[], partner_location_preference, partner_expectations_visibility

**Финансы (Экран 9) — ВСЁ НОВОЕ:**
- monthly_income_range, financial_obligations_status, income_stability_status, financial_stability_importance, family_finance_management_model, financial_priorities[], financial_data_visibility

**Образ жизни (Экран 10) — ВСЁ НОВОЕ:**
- lifestyle_type, free_time_interests[], daily_rhythm, bad_habits_status, nutrition_type, alcohol_attitude, drug_use_status, lifestyle_visibility, sensitive_habits_visibility

**Родители (Экран 11) — ВСЁ НОВОЕ:**
- father_status, father_age_range, father_activity_type, father_current_work_status, mother_status, mother_age_range, mother_activity_type, mother_current_work_status, parents_marital_status, parents_opinion_importance, early_family_introduction_readiness, family_environment_notes, parents_data_visibility

**Будущая семья (Экран 12):**
- future_living_format (расширенный), relocation_after_marriage_readiness, separate_from_parents_importance, future_home_location_preference, living_conditions_notes, future_living_visibility

**Здоровье (Экран 13) — ВСЁ НОВОЕ:**
- general_health_status, physical_activity_level, chronic_health_conditions_status, family_life_health_impact_status, health_additional_notes, health_data_visibility, health_moderation_status

**Гео-предпочтения (Экран 14):**
- future_location_preference, preferred_countries[], relocation_for_family_readiness, family_proximity_importance, location_preference_notes, geo_preferences_visibility

**Доверенное лицо (Экран 15) — ВСЁ НОВОЕ, отдельная таблица?:**
- trusted_person_enabled, trusted_person_last_name, trusted_person_first_name, trusted_person_relation, trusted_person_country, trusted_person_city, trusted_person_phone, trusted_person_secondary_phone, trusted_person_email, trusted_person_contact_permission, trusted_person_status, trusted_person_visibility

**Приватность (Экран 16):**
- profile_visibility_mode (вместо нашего status), profile_search_visibility, + 8 visibility-полей для каждого блока

**Системные (Экраны 17-20):**
- profile_preview_status, photo_moderation_status, privacy_summary_status, hidden_sections[], visible_sections[], editable_sections[], profile_ready_for_review, profile_submission_status, profile_review_status, profile_review_queue_status, estimated_review_time, review_notification_channel, identity_verification_status, birth_date_verification_status, phone_verification_status, photo_verification_status, profile_data_review_status, document_review_status

### Что у нас есть, но в спеке нет

- `citizenship` — спека не упоминает (паспорт = source). Оставим, не мешает.
- `religion_practice` (4 опции, мы делали 2 дня назад) — спека хочет вернуть шкалу `religion_importance_level` 1-5. **Откатить?**
- `religion_partner_match` (3 опции) — спека хочет 6 опций `partner_religion_preference`. **Расширить.**
- `native_language` — спека не упоминает; в спеке только `languages[]`. **Удалить?**
- `post_marriage_living` — спека делает 4 поля вместо одного. **Заменить.**

---

## 3. Архитектурные решения для V3

### А. Структура БД: одна таблица или несколько?

**Вариант 1: всё в `user_profiles`** (текущий подход)
- 150 колонок в одной таблице
- Минусы: тяжёлый INSERT/UPDATE, JSON-ная гибкость теряется, sparse data (много nullable)

**Вариант 2: split по доменам** (рекомендую)
- `user_profiles` (basic, geo, bio, education)
- `user_family` (marital, children, parents)
- `user_values` (values, religion, family_model)
- `user_partner_preferences` (ожидания)
- `user_finances` (доход, стабильность, приоритеты)
- `user_lifestyle` (habits, interests, schedule)
- `user_health` (health data, нужен отдельный consent)
- `user_trusted_person` (1:N — может быть несколько в будущем)
- `user_privacy_settings` (все visibility-поля)
- `user_profile_review` (статусы модерации)

Преимущества: чище модель, легко делать ALTER TABLE, можно отдельно GDPR-erase здоровье/финансы.

**Вариант 3: гибрид — основное в user_profiles + jsonb-blob для редких полей**
- Минусы: матчинг придётся читать jsonb (медленнее)

**Решение:** Вариант 2 (split). Это major DB-рефакторинг — Sprint 1 на это уйдёт целиком.

### Б. Per-field visibility — как хранить?

Спека требует `*_visibility` для большинства блоков (5 уровней: visible_to_verified_users / after_mutual_interest / by_explicit_consent_only / hidden / matching_only).

**Решение:** колонка `*_visibility text` в каждой relevant таблице со CHECK constraint enum. Не делать generic visibility-таблицу — overkill.

### В. ИМТ — computed или stored?

Computed (формула `weight / (height/100)²`). Не нужна колонка. Считается во view-layer / display.

### Г. OneID / MyID — что это?

Это госуслуги Узбекистана для верификации личности (https://oneid.uz / https://myid.uz). Спека предполагает что данные паспорта подтягиваются автоматически из этих сервисов.

**Текущее у нас:** мы делаем паспорт+селфи руками через мини-аппу + админ модерирует. OneID — отдельная интеграция, требующая партнёрства с госуслугами.

**Решение:** в MVP V3 НЕ интегрируем OneID. Поля `official_name` / `gender_verified_source` оставляем nullable. Используем существующий flow (паспорт + админ-проверка). OneID — отдельный sprint после MVP.

### Д. Bio модерация (Чат 8 Legal)

Спека требует модерацию bio при изменении (запрет контактов, ссылок, мата). Нужна admin queue + автоматические правила.

**У нас уже есть:** `containsContact()` в schemas.ts (фильтр на телефоны/ссылки/мессенджеры). Не хватает: модерационная очередь для пограничных случаев.

### Е. Доход в сумах

Спека: 5 диапазонов в сумах (< 5М / 5-10М / 10-20М / 20-40М / 40М+). UZ-специфика.

**Вопрос:** для не-UZ-юзеров (за рубежом) показать другие диапазоны? Спека не уточняет — нужен вопрос продукту.

---

## 4. Sprint roadmap (предложение)

### Sprint 1 — DB foundation V3 (1.5 нед)
- Split существующего `user_profiles` на 10 таблиц (миграция с backfill)
- Создать enum'ы для всех новых вариантов (50+ enum types в БД, скорее всего text + CHECK)
- Адаптировать существующие API (basic/family/values/appearance/marriage) под новую структуру
- Тесты на миграцию (data integrity)
- **Deliverable:** новая БД готова, тесты зелёные, старые экраны работают (display only)

### Sprint 2 — Экраны 1-4 переделка (2 нед)
- Экран 1 расширение (ИМТ, languages[], OneID-placeholder)
- Экран 2 — место рождения (4 поля) + visibility + готовность к переезду
- Экран 3 — переделать "О себе" с модерацией bio + новый список activity_field (17 опций)
- Экран 4 — Фотографии (минимальные изменения, спека требует 3 фото обязательно)
- **Deliverable:** первые 4 экрана соответствуют спеке

### Sprint 3 — Экраны 5-10 (2 нед)
- Экран 5: О семье и детях (children_count, age, age_ranges)
- Экран 6: Ценности и вера (вернуть шкалу 1-5)
- Экран 7: **Семейная модель** (новый, 4 опции)
- Экран 8: **Ожидания от партнёра** (расширить — height, qualities[], location)
- Экран 9: **Финансы** (новый, 6 полей)
- Экран 10: **Образ жизни** (новый, 7 полей)

### Sprint 4 — Экраны 11-16 (2 нед)
- Экран 11: **Родители** (новый, 12 полей)
- Экран 12: **Будущая семья** (новый — наш marriage расширить)
- Экран 13: **Здоровье** (новый, с отдельным consent)
- Экран 14: **География-предпочтения** (новый)
- Экран 15: **Доверенное лицо** ⭐ (новая таблица, валидация телефона)
- Экран 16: **Приватность** (новый — глобальный + per-block visibility)

### Sprint 5 — Экраны 17-20 + polish (1.5 нед)
- Экран 17: Предпросмотр с per-section редактированием
- Экран 18: Сводка статусов проверок
- Экран 19: Очередь модерации + ETA + выбор канала уведомления
- Экран 20: Опубликована / отклонена / скрыта
- Matching algorithm обновление под новые поля (или отдельный Sprint 6)

### Если очень-очень быстро — MVP V3 в 2 спринта
- Sprint 1: миграция + экраны 1-2-3-4-5-6 (минимум что есть)
- Sprint 2: экраны 7-10 + матчинг

Но это значит **6 ключевых экранов спеки (11/12/13/14/15/16) не реализованы** в первом MVP. Доверенное лицо отложено, приватность не настраиваемая, здоровье не собирается.

---

## 5. Технические долги от этого редизайна

- Старые миграции 20260628100000 (мои onboarding V2 ext) — частично станут не нужны. `religion_practice` поле возможно удалится. `post_marriage_living` сменит структуру. Это нормально — БД эволюционирует.
- Матчинг (`match-story.ts`, `match-of-the-day.ts`) — нужно полностью переписать под новые поля (top_life_values, family_views, partner_top_qualities, family_role_model и т.д.).
- Admin: client card нужно расширить новыми табами (Family / Lifestyle / Health / Parents / Trusted Person).

---

## 6. Открытые продуктовые вопросы — НУЖНЫ ОТВЕТЫ УЧРЕДИТЕЛЯ

### Q1: Что важнее — успеть к дате или сделать всю спеку?

Если есть deadline — режем до MVP (Sprint 1+2, 6 экранов). Если нет — делаем все 20 экранов 4-5 sprint'ов.

### Q2: OneID / MyID — интегрируем сейчас или потом?

OneID — отдельный sprint с партнёрством. Я предложил бы **не интегрировать** в MVP, а оставить существующий paspport+selfie+admin flow и официальное_имя как nullable. Согласен?

### Q3: Религия — оставить мою переработку (4 качественных опции) или вернуть к спеке (шкала 1-5)?

Я делал 2 дня назад по твоей же поправке — убрать шкалу. Спека возвращает её. **Что делаем — приоритет спеки или твоей поправки?**

### Q4: Доверенное лицо — обязательно или опционально?

Спека предполагает что юзер может его не добавить (`trusted_person_enabled = no`). Это требует валидации телефона (как отдельный entity без своего account). Делать или отложить?

### Q5: Поле "Доход" в сумах — обязательно?

5 диапазонов в сумах. Для не-UZ юзеров — что делать? Конвертация в USD? Скрывать поле?

### Q6: Health data — отдельный consent?

Это категория особых ПД по 152-ФЗ / UZ-закону. Нужен отдельный консент `health_data_consent` в боте? Или собираем по факту в анкете без extra consent?

### Q7: Per-field visibility — все 8 блоков сразу или MVP с 2-3?

В MVP можно ограничиться: `profile_visibility_mode` (3 опции глобально) + visibility для здоровья/финансов/доверенного лица. Остальное (basic_info, education) — public всегда. Согласен?

### Q8: Текущая база у нас уже PUSH'нута с onboarding V2 ext (citizenship/appearance/marriage). Откатывать или сверху мигрировать?

Я бы **сверху мигрировал**: existing миграции остаются, новая миграция splits на 10 таблиц с переносом данных. Согласен с этим подходом или хочешь полный wipe?

---

## 7. Что я предлагаю сделать первым

1. **Ты отвечаешь на Q1-Q8** выше. Это блокирующее — без ответов риск делать не туда.
2. После твоих ответов я уточняю план (выбор: MVP-режим vs полная спека, OneID/no, religion как)
3. Открываю первую миграцию (Sprint 1) — split user_profiles на доменные таблицы. Это reversible но большая работа (~3-4 дня)
4. Параллельно начинаю Экран 1+2 UI

**Не начинаю код пока не будет ответов на Q1-Q8.** Слишком велик scope — ошибка в архитектуре сейчас будет дорого исправлять через 2 спринта.

---

## Status

- [x] Извлечена вся спека (1519 строк tech-секций в /tmp/anketa-tech.md)
- [x] Gap analysis vs текущий V2 extended
- [x] Sprint roadmap скетч
- [ ] Ждём ответов на 8 продуктовых вопросов
- [ ] Sprint 1 (миграция БД)
