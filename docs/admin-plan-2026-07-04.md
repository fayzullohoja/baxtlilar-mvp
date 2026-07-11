# Admin — секвенированный план работ (2026-07-04)

Основан на свежем аудите 7 зон (workflow `admin-audit-for-plan`). Дедуплицированы кросс-зонные дубли: SG-04≡QZ-7, SG-05≡REP-1, SG-06≡DZ, SG-07≡PT, SG-08≡QZ-5.
Уже сделано ранее (НЕ в плане): VF-1 (триггер+счётчик), аналитика (воронка/North Star), TOTP-2FA, scope-guard кейса.

Принцип порядка: критичное+дешёвое → главный content-гэп → операторские действия → репорты → масштаб → полировка/a11y → крупные модули (нужны решения учредителя).

---

## ВОЛНА 0 — Критичные быстрые фиксы (все S, независимы) · 1 коммит
- **PH-1** (critical) — юзер не узнаёт об отклонении фото: подключить `notifyUser()` в `photos/[id]/decision` при reject (RU/UZ). ~10 строк, максимальный эффект.
- **PT-3** (high) — «Город» в карточке всегда «—» (читается мёртвая колонка `city`): заменить на region+district.
- **QZ-5 / SG-08** (med) — персист face-match аттестации (3 booleans + who/when) в case_events: юр-аудит «сверки лица» сейчас испаряется.
- **UX-ESLINT** (med) — починить 5 react-hooks ошибок (CaseStudio/SearchBar/PhotoDrawer/PhotosTable).

## ВОЛНА 1 — Модератор видит ВСЮ анкету V4 (главный content-гэп, решение учредителя №4)
Сейчас `ProfileTab` не читает `extended` jsonb и половину hot-колонок → модератор проверяет вслепую (нет финансов, образа жизни, семейной модели, partner-extended, квиза).
- **PT-1 (critical) + PT-2 + PT-4 + PT-6** — один загрузчик `load-profile-full.ts` (hot-колонки + parse extended + quiz) + секционный рендерер (лейблы уже все в `options.ts`/`questions.ts`, без visibility-gating).
- **QZ-6** — мини-панель «Самозаявлено» в CaseStudio для cross-check с паспортом (подсветка расхождений).
- **PT-5** — показывать реальные partner-prefs, а не захардкоженный `geo_preference`.

## ВОЛНА 2 — Операторские действия / danger-zone (решения №2 hard-delete, №3 restart→wipe)
Бэк ban/unban/unblock готов, UI нет; hard-delete и restart отсутствуют как класс.
- **DZ-1 (critical)** — `DangerZone.tsx` в карточке клиента: провязать ban/unban/unblock (confirm+reason, superadmin-gated). Разблокирует 3 из 5 одним компонентом.
- **DZ-3 (high)** — `admin_restart_onboarding` (WIPE consents) + route + кнопка. Guard против restart для blocked/pending_ban.
- **DZ-2 (high)** — `admin_hard_delete_user` + route + typed-confirm. Собрать storage-пути до удаления, обойти append-only case_events trigger, adminAudit до исчезновения строки.
- **DZ-4 / UL-4** — фильтр «Удалённые/Заблокированные» в директории.

## ВОЛНА 3 — Репорты: triage с доказательствами и реальной санкцией
- **REP-1 / SG-05 (high)** — `/admin/reports/[id]`: evidence-чат по `reports.chat_id` (в админке чат сейчас не читается вообще) + профиль цели + история жалоб.
- **REP-2 (high)** — «Меры приняты» применяет реальную санкцию к target (link → ban из Волны 2), а не просто меняет status.
- **REP-3 + REP-4** — недостижимые решения (escalate/confirmed/requires_clarification) + UI-поле причины + seed report-шаблонов.
- **REP-6 + REP-7** — сортировка по числу разных жалобщиков; мёртвая ветка `resolved`.

## ВОЛНА 4 — Масштаб на 10k (без этого админка тихо теряет строки — тот же класс, что VF-баг)
- **UL-1 (high)** — поиск молча игнорирует активный фильтр статуса/пола → единый путь q+filters.
- **UL-2 (high)** — пагинация (сейчас потолок 50 на 10k).
- **UL-3 (high)** — фильтр по verification_status. **UL-5** — gender-фильтр внутрь RPC (не fetch-all-then-.in).
- **QZ-1 (high)** — очередь «Все открытые кейсы» (assignee+возраст) — счётчик дашборда глобальный, а достижимы только mine+unassigned.
- **QZ-2 (high)** — ручной release/unclaim/reassign кейса (сейчас выход только через 7-дневный авто-reclaim).
- **QZ-7 / SG-04 (med)** — дашборд: SLA/aging/«Требуют внимания» (сейчас плоские счётчики).
- **PH-6** — partial-индекс под очередь фото (сейчас seq-scan). **QZ-10** — пагинация очереди.

## ВОЛНА 5 — Полировка фото + кейсов (ops-удобство)
- **PH-2** — photo_type (portrait/full_body/**family**) видим модератору. **PH-3** — действия approve/reject прямо в PhotosTab клиента. **PH-4** — оживить needs_replacement (запрос замены). **PH-5** — optimistic UI + защита от двойного клика. **PH-7/PH-8** — lang шаблонов из сессии + verification-пилюля.
- **QZ-3** — case_notes UI (таблица есть, консьюмеров нет). **QZ-4** — таймлайн case_events. **QZ-8/QZ-9** — убрать мёртвые состояния кейса + свести scope-модель.

## ВОЛНА 6 — Дизайн/UX-полировка (вариант A: полировать ops-tool) + a11y
- **UX-FOCUS (high)** — глобальный `:focus-visible` (сейчас клавиатурный фокус невидим). **UX-DIALOG-A11Y (high)** — focus-trap/return в Dialog/Drawer.
- **UX-TOKENS + UX-PRIMITIVES + UX-DENSITY** — свести два токен-механизма к одному, вынести общие Table/EmptyState, провести радиусы.
- **UX-D1/BODY-BG/FONTS/ERROR-SKIN/LOADING/NOTFOUND/DEADCTRL** — долг D1–D6 + skeleton-состояния + переверстать error.tsx с mini-app-коралла на ADMIN-токены + решить судьбу мёртвых контролов (Cmd+K/Bell/badge).

## ВОЛНА 7 — Крупные модули Чат-7 (нужны решения учредителя по объёму) 🟡
- **SG-01 (high, L)** — RBAC-матрица (сейчас бинарный superadmin/moderator вместо per-permission).
- **SG-02 (high, L)** — экран Staff & Roles (сейчас админы создаются прямым INSERT).
- **SG-11 (XL)** — недостающие модули: сначала **System Settings** (режим регистрации + toggle модерации анкет), **International review queue**, **Notifications**; остальное (Tariffs/Family/Matching-status/Interests/Compatibility) — отложить.
- **SG-09 (med)** — аудит просмотров чувствительных данных (кто смотрел паспорт/селфи). **SG-10** — masking PII в директории. **REP-5/REP-8** — SLA/assign для репортов + развилка «видит ли модератор жалобы».

---

## Решения учредителя, нужные для поздних волн
1. **REP-8** — жалобы видит только superadmin (сейчас так, F-120) или открыть модератору?
2. **SG-11** — какие модули входят в MVP-админку (рекомендую 3: System Settings, Intl queue, Notifications).
3. **SG-01** — набор ролей/прав для RBAC (или оставить бинарно до пост-запуска).
4. Bulk-действия (UL-7) — спека запрещает массовый delete; какие безопасные bulk нужны.
