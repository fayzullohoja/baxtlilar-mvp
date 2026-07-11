# Baxtlilar — план ревью-фиксов и незавершёнки (2026-07-09)

Источник: воркфлоу `full-review-discovery` (36 агентов, адверсариальная верификация). Данные: scratchpad/review-result.json.

**Итог:** 20 подтверждённых багов + 81 незавершённых пунктов (ещё открыты/частично).


## A. Подтверждённые баги (чинить)

- **[CRITICAL]** `supabase/migrations/20260627100400_admin_case_rpcs.sql:172` — Moderator 'needs_changes' decision is a silent dead-end: admin_reject_verification updates only users.verification_status and never sets onboarding_step, but the router (router.ts nextScreenFor / client-paths.ts clientNextPath) routes purely on lifecycle_state + onboarding_step and ignores verification_status — so the user is never routed to /onboarding/needs-changes to re-upload.
- **[CRITICAL]** `src/lib/telegram/bot/handlers.ts:156` — createInitial() inserts language=detectLang(tg) with no ru-fallback; for a Turkish-locale Telegram client this writes language='tr', which violates the users_language_check constraint unless migration 20260709120000 has been applied first — the INSERT fails and the user cannot register.
- **[HIGH]** `supabase/migrations/20260627100400_admin_case_rpcs.sql:174` — Technical rejection (action='reject_technical') is broken identically: admin_reject_verification sets verification_status='rejected' but never sets onboarding_step='verification_rejected', so the /onboarding/rejected page + RetryButton + /api/onboarding/retry (which all guard on onboarding_step==='verification_rejected') are unreachable for a Shadow-Active user.
- **[HIGH]** `src/components/v2/WelcomeBranded.tsx:335` — The welcome-screen's local LanguageSwitcher hardcodes only [{code:'ru'},{code:'uz'}] and was not updated for tr; the entry screen offers no TR button and shows no active state for a TR user.
- **[MEDIUM]** `src/app/api/onboarding/profile/lifestyle/route.ts:37` — Read-modify-write of the `extended` jsonb column drops the read error, so a transient read failure silently wipes sibling sections (extended.finance, extended.family) that were saved on earlier steps.
- **[MEDIUM]** `src/app/api/onboarding/profile/finance/route.ts:40` — Same swallowed-read-error pattern: the `select("extended")` read error is discarded, so a transient failure overwrites `extended` and wipes any sibling sections (e.g. extended.family) already written.
- **[MEDIUM]** `src/app/api/onboarding/profile/family-model/route.ts:44` — Same swallowed-read-error pattern in the conditional cold-field merge: the `select("extended")` error is dropped, so a transient failure while merging family cold fields can overwrite `extended` and wipe other sections.
- **[MEDIUM]** `src/components/v2/VerificationPlashka.tsx:43` — Even for users who reach /main (lifecycle=active), the needs_changes card has no recovery CTA: the component header comment promises 'needs_changes → "Нужно поправить" + кнопка' but the needs_changes branch (and the JSX) render only eyebrow/title/body text — no button or link to re-upload.
- **[MEDIUM]** `src/lib/telegram/bot/handlers.ts:597` — Only the literal /start text path is rate-limited; the fallthrough text path, the contact path, and the null-user callback path all trigger unthrottled findByTg (DB read) + sendMessage, the exact 'sendMessage amplifier' the SEC-3a cooldown was added to prevent.
- **[MEDIUM]** `/Users/fayzullohoja/Code/baxtlilar/src/lib/matching/score.ts:75` — The confidence-blend that is supposed to pull under-quizzed candidates toward NEUTRAL never actually blends: `confidence = presentWeight` (line 73) is only ever 0 or 1, and the answer-count signal `answered` produced by the quiz is silently ignored, so a barely-quizzed candidate is scored at full confidence against fabricated neutral data.
- **[MEDIUM]** `/Users/fayzullohoja/Code/baxtlilar/supabase/migrations/20260706120000_match_geo_birth_region.sql:84` — A candidate whose interest the viewer already DECLINED re-appears in the viewer's recommendations / match-of-the-day, because the declined-request exclusion only covers requests the viewer SENT (sender = p_viewer), not requests the viewer received and declined, and declining does not write a match_views dedup row.
- **[MEDIUM]** `/Users/fayzullohoja/Code/baxtlilar/src/lib/matching/recommend.ts:50` — When the eligible candidate pool exceeds 100, the globally best-scoring match can be excluded before JS scoring ever sees it: the RPC returns only the 100 lowest-UUID rows (`order by c.id limit p_limit`, p_limit hardcoded to 100), and JS then scores/sorts only that arbitrary window.
- **[MEDIUM]** `src/lib/profile/options.ts:311` — WIFE_WORK_VIEW option 'prefer_not' has a hardcoded feminine RU verb ('...чтобы не работала') that is wrong for female users, who are asked about their husband's work.
- **[LOW]** `src/lib/state-machine/transitions.ts:99` — tryTransition maps EVERY TransitionError to `409 wrong_step`, so genuine server-side failures (RPC failure, user-not-found) are reported to the client as a 409 wrong-step conflict instead of a 500.
- **[LOW]** `src/lib/telegram/bot/handlers.ts:456` — The bio:yes branch calls transition() (throws on ConcurrencyError/TransitionError) instead of tryTransition() used by the lang: (387) and phone (563) branches; on a concurrent double-tap of 'bio:yes' the second event's transition throws and the generic catch shows 'Error, try /start' even though consent was recorded and the step already advanced.
- **[LOW]** `src/lib/telegram/bot/handlers.ts:186` — Stale comment in buildAppWebUrl claims /api/auth/bootstrap reads the &lang= query param to set the NEXT_LOCALE cookie, but bootstrap actually derives locale from row.language (route.ts:150-160); the lang query param is not consumed there. Not a functional bug — DB value is authoritative and correct — but the comment misleads future maintainers about how tr persistence flows.
- **[LOW]** `/Users/fayzullohoja/Code/baxtlilar/src/lib/matching/score.ts:58` — Shared-values count is computed with `viewer.values.filter(v => cand.values.includes(v)).length` without de-duplication, so duplicate entries in the viewer's top_life_values array inflate the shared count (each duplicate that overlaps is counted again, up to the min(...,3) cap).
- **[LOW]** `src/components/v2/AnketaFields.tsx:209` — Select/City placeholder text is still `locale === 'uz' ? 'Tanlang…' : 'Выберите…'` (lines 209 and 308), so a TR user sees a Russian placeholder even though the option labels beside it were migrated to optLabel().
- **[LOW]** `src/lib/profile/schemas.ts:168` — familySchema (uses deprecated children_plan) and valuesSchema (uses deprecated values/employment) are defined but never consumed anywhere; V4 uses familyChildrenSchema/valuesV3Schema instead. Dead duplicates that will silently drift.
- **[LOW]** `src/components/v2/AnketaFamilyModelForm.tsx:128` — The household_responsibility_model option remap builds {value, ru, uz} only and drops the tr label, so Turkish users see Russian text for that dropdown.

## B. Незавершённое — НЕ заблокировано (исполнимо автономно)

- **[P0/M]** Ночной шифрованный off-site backup Railway Volume /data (паспорта+селфи тысяч пользователей) в R2/S3. Роут /api/cron/backup + volume-backup.ts + BACKUP_ENCRYPTION_KEY не созданы.  
  _src:launch-readiness Cluster B (INFRA-01); p0-plan SEC-1a · still-open_
- **[P0/M]** OA-3 / SG-06 — нет UI-поверхности для user-level действий: ModerationTab полностью read-only, ban/unban/unblock написаны server-side, но НЕ провязаны в UI  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P0/M]** E-2 — sentinel far-future ('infinity') для неоткрытых pending, чтобы 3 предиката process_interest не сломались при nullable TTL (регресс-тест обязателен)  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P0/S]** C1 — display_name сделать настоящим ником: не посевать паспортным TG-именем, реворд label→«отображаемое имя/ник», мягкий рефайн «одно слово»  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/L]** SG-04 — на дашборде нет SLA / capacity / «Требуют внимания»; плоские счётчики  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P1/L]** SG-05 — обработка жалоб неполна: нет /admin/reports/[id] detail, нет assign/priority/evidence/escalate-to-legal/notes; таблица reports без priority/assigned_to/category/evidence  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P1/L]** SG-07 — нет модерации контента анкет (bio/цели не гейтятся апрувом перед публикацией); ProfileTab read-only  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P1/M]** Ops-алерты в Telegram на сбой крона, застой tg_outbox (attempts>=5 бросаются молча), всплеск admin-login-throttle (credential-stuffing). sendOpsAlert/alert.ts не создан.  
  _src:launch-readiness Cluster F (INFRA-06); p0-plan SEC-4b/OBS-7/OBS-8 · still-open_
- **[P1/M]** Карточка клиента в админке (ProfileTab) отстаёт от анкеты V4/V5: SELECT читает только 16 легаси-колонок, не читает extended jsonb и V4-поля (рост/вес, finance, lifestyle вкл. alcohol_level/drugs_use, family_role_model, partner-блок). Модератор не видит moderation-релевантные поля.  
  _src:audit-mvp-vs-spec (OPS-10/PD-01..12); p0-plan AR-1..AR-5 · still-open_
- **[P1/M]** Отзыв согласия (UI/эндпоинт) и админ-вью правового статуса пользователя. RPC withdraw_consents есть, но нет endpoint /api/account withdraw_consent и нет LegalTab в админ-карточке.  
  _src:audit-mvp-vs-spec LEGAL-005/015/003/016; p0-plan LC-8 (admin) / LC-7 (withdrawal) · partial_
- **[P1/M]** Safety Center «Жалобы и блокировки» + список заблокированных пользователей. У /api/block нет GET, в v2/settings нет консолидированного раздела safety, нет вью ограничений аккаунта.  
  _src:audit-mvp-vs-spec SAF-013 · still-open_
- **[P1/M]** Просмотр паспорта/селфи в админке мятит signed URL без запроса причины и без записи в аудит; нет отдельного download-permission.  
  _src:audit-mvp-vs-spec ADM-VER-014 (2A) · still-open_
- **[P1/M]** PD-01..PD-12 — карточка клиента (ProfileTab) отстала от анкеты V4 на 13 полей: appearance(рост/вес), birth_place, activity/employment/native_lang, children_count/age, religion_practice, post_marriage_living, family-model, ВЕСЬ extended.finance, ВЕСЬ extended.lifestyle (alcohol/drugs невидимы модератору), partner-extended, district/region/country, privacy_mode  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P1/M]** PD-13 — квиз Big Five (quiz_results.vector) полностью невидим в карточке, нет таба  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P1/M]** §3 Семейный статус — гендерное разделение: М (never/divorced/widowed/married_separated), Ж (+prior_experience, +married_separated), убрать other. married_separated — РЕШЕНО оунером: да  
  _src:anketa-v5-owner-spec-2026-07-07.md · still-open_
- **[P1/M]** E-1 — цикл интереса: добавить seen_at, инвертировать якорь TTL (creation→open), sentinel infinity до открытия, flip на now()+48h  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/M]** E-5 — «удаляется» из спеки → soft-expire (status='expired'), консистентно с проектом  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/M]** D1 (chat) — архивация mutual-чата по 48ч неактивности (рекомендация: derived/lazy в get_chat_list, обходит крон-P0)  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/M]** B3 — опциональный слот full_body в форме + модерации; сервер валидирует photo_type  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/S]** C5 — выровнять consent: в оферте/hint явно «отображаемое имя видят другие; паспортное — только для верификации»  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/S]** B1 — колонка photo_type (portrait/full_body/family) в profile_photos + backfill is_main→portrait  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/S]** B2 — обязательный портрет на publish: заменить count>=1 на «exists портрет»  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P1/S]** B4 — приоритет portrait в аватаре (mini.ts), чтобы семейное не попало в аватар  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P2/L]** Пакет недостающих/расходящихся полей анкеты: residence_format+relocation_readiness (ANK-05), оси education/activity_field/employment_format (ANK-07), family_views[] не собирается (ANK-16), partner-предпочтения height/religion/location (ANK-18), поля будущей семьи Экрана 12 (ANK-24).  
  _src:audit-mvp-vs-spec ANK-05/07/16/18/24 (собрано) · still-open_
- **[P2/L]** SG-01 — RBAC сведён к 2 хардкод-ролям (superadmin/moderator) vs матрица спеки; нет per-permission модели  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/L]** SG-02 — нет экрана Staff & Roles (invite/change-role/block, last-activity); админы создаются прямым INSERT  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** Логирование заблокированных попыток отправки контактов + аудит блокировок/жалоб. Блокировка контактов работает (400), но попытки не пишутся в аудит; blocks.upsert и reports.insert не логируются.  
  _src:audit-mvp-vs-spec SAF-015/SAF-022 · still-open_
- **[P2/M]** 30-дневный purge сырого phone_number для незавершённых регистраций + 7d stale-переход (bot_completed_stale). Housekeeping-крон это не делает.  
  _src:audit-mvp-vs-spec SYS-007 · still-open_
- **[P2/M]** Фото: общий загрузчик без типизированных слотов (portrait/full_body/family), приём JPEG/PNG/WebP/HEIC до 12MB вместо JPG/PNG до 10MB, sha256 для профильных фото не вычисляется (дедуп невозможен).  
  _src:audit-mvp-vs-spec ANK-10 · still-open_
- **[P2/M]** Правовой long-tail: интерактивное предупреждение о фото третьих лиц/семьи при загрузке (LEGAL-010), по-документное версионирование + ре-запрос согласия (LEGAL-014), вью истории согласий в профиле (LEGAL-018), дисклеймер off-platform ответственности в точке чата (LEGAL-021), логирование/ролевой гейт self-export (LEGAL-026).  
  _src:audit-mvp-vs-spec LEGAL-010/014/018/021/026 (собрано) · still-open_
- **[P2/M]** Нет валидации матрицы переходов lifecycle_state (deleted терминальный). transition_user слепо coalesce-ит lifecycle_state из патча без from→to проверки; нелегальные рёбра (deleted→active, blocked→paused) проходят.  
  _src:audit-mvp-vs-spec SYS-004 · still-open_
- **[P2/M]** VF-4 — guard определяет «в очереди» третьим более строгим предикатом (pending_review AND lifecycle=onboarding); /admin/cases минует guard  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** OA-1 — Hard-DELETE тест/спам-аккаунтов: нет роута/RPC. erase_user засоряет anti-catfish blacklist мусорными SHA/телефонами  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** SG-08 — face-match = ручная 3-чекбокс аттестация без similarity_score; не персистится в case-audit  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** SG-09 — аудит не логирует просмотры чувствительных данных (паспорт/селфи/PII); adminAudit только на WRITE  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** SG-10 — clients directory показывает полные PII суперадмину без masking/reason-gate  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/M]** Ось 2 (дети + модель семьи) — re-rank-only deal-breakers (childrenTerm, familyModelTerm)  
  _src:matching-audit-2026-07-04.md · still-open_
- **[P2/M]** Ось 5c — coarse-score в SQL + p_limit 100→200  
  _src:matching-audit-2026-07-04.md · still-open_
- **[P2/M]** Ось 4 — кеш user_daily_match (retention-якорь дня после фикса F5)  
  _src:matching-audit-2026-07-04.md · still-open_
- **[P2/M]** Ось 3b — geo relax-рунга в SQL (region@L0/country@L1) + обобщение caution (честность ladder)  
  _src:matching-audit-2026-07-04.md · still-open_
- **[P2/M]** partner_top_qualities — плотное поле не в ранге; нет self-quality колонки для симметричного сравнения; комментарий миграции «used in match score» ложный  
  _src:matching-audit-2026-07-04.md · still-open_
- **[P2/M]** #84 / Экран 15 — Доверенное лицо (deferred to settings)  
  _src:task: deferred v4.1 · still-open_
- **[P2/S]** Блокировка женатых пользователей (OD-12) с уважительным предупреждением. MARITAL_STATUS не содержит значения 'married' и нет гейта — женатый выбирает 'other' и проходит.  
  _src:audit-mvp-vs-spec SYS-033 (OD-12) · still-open_
- **[P2/S]** bio валидируется как 20-1000 символов вместо требуемых 30-250 слов; нет отклонения грубости/неуместного контента на вводе.  
  _src:audit-mvp-vs-spec ANK-08 · still-open_
- **[P2/S]** PD-14 — gender/birth_date/citizenship показываются из паспорта user_identity, не из самозаявленного user_profiles; у неверифицированного юзера анкетные значения не показаны  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D1 — editorial serif протекает в логотип admin («Baxtlilar Ops» с font-v2-display) вопреки «никаких серифов»  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D2 — радиусы захардкожены/несогласованы; токены --admin-radius не читаются; login-карточка 10px one-off  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D3 — «density modes» рекламируются, но ноль консьюмеров (нет data-density)  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D4 — мёртвые токены (--admin-border-strong) и utility-классы (.pinfl/.passport-num/.mono) не используются  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D5 — root layout body bg-slate-100 (третий нейтрал) даёт холодную вспышку при cold paint  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** D6 — именованные вебшрифты (Inter/JetBrains Mono/display-serif) не грузятся ни в admin, ни в mini-app; v2-заголовки в Georgia/Times  
  _src:admin-gap-report-2026-07-01.md · still-open_
- **[P2/S]** §9 Жильё (HOUSING_STATUS) — новый enum  
  _src:anketa-v5-owner-spec-2026-07-07.md · partial_
- **[P2/S]** §4 Планы на детей — 2 вопроса: Q1 реворд (4 опции) + Q2 новый CHILDREN_COUNT_VIEW (взгляд на количество)  
  _src:anketa-v5-owner-spec-2026-07-07.md · still-open_
- **[P2/S]** C2 — задокументировать инвариант имён (НЕ заводить колонку legal_name; паспорт изолирован в user_identity)  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P2/S]** D3 (chat) — надёжный планировщик (нужен ТОЛЬКО для materialized-варианта D1; при derived отпадает)  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P2/S]** A2 — divorced_multiple («2+ разводов») safe; married_separated — по решению учредителя  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P2/S]** A6 — education_field (специальность обучения) free-text ≤60, opt., cold в extended, containsContact()  
  _src:owner-feedback-plan-2026-07-07.md · still-open_
- **[P2/S]** A7 — Жильё (housing_status) cold в extended.living  
  _src:owner-feedback-plan-2026-07-07.md · partial_
- **[P2/S]** #85 — Onboarding interstitial для swap appearance↔birth-place (объяснить пользователю смену порядка экранов)  
  _src:task: deferred v4.1 · still-open_
- **[P3/S]** Копия/дефолты: гарантия анонимности после жалобы (SAF-009), полное pre-chat предупреждение с адресом/документами/работой вместо урезанного safety_tip_extended (SAF-016), дефолт profile_visibility_mode → verified_only вместо public (ANK-29).  
  _src:audit-mvp-vs-spec SAF-009/SAF-016/ANK-29 (собрано) · still-open_

## C. Незавершённое — требует РЕШЕНИЯ учредителя

- **[P0]** C3 — утечка фамилии post-mutual: RevealedProfile рендерит ПОЛНЫЙ display_name (нужно резать до firstWord, если «фамилию никогда не показываем») _(src:owner-feedback-plan-2026-07-07.md)_
- **[P1]** Case-based scope-guard для модераторов. requireInQueueOrSuper/checkInQueueOrSuperPage всё ещё гейтят по (verification_status='pending_review' AND lifecycle_state='onboarding'), а не по открытому verification_case. _(src:launch-readiness Cluster C (OPS-01, VF-1 residual); p0-plan VER-4)_
- **[P1]** Гранулярная RBAC для доступа к документам/селфи/чатам/жалобам (роли Verification/International Manager) — только 2 хардкод-роли superadmin/moderator, all-or-nothing. _(src:audit-mvp-vs-spec LEGAL-028; p0-plan SEC-2 (2FA часть закрыта))_
- **[P2]** OA-2 — RESTART onboarding: нет пути сбросить юзера на повтор онбординга _(src:admin-gap-report-2026-07-01.md)_
- **[P2]** SG-11 — отсутствуют операционные модули: Тарифы/платежи, Family, Matching status, Интересы/чаты, Individual, International, Тест совместимости, Уведомления, System Settings _(src:admin-gap-report-2026-07-01.md)_
- **[P2]** §7 Работа — упростить до 5 опций (работаю/учусь/предприниматель/пока не работаю/не хочу отвечать) _(src:anketa-v5-owner-spec-2026-07-07.md)_
- **[P2]** Переупорядочивание анкеты — 9 тематических секций вместо 15 шагов state-machine + вставка блока «Родители» _(src:anketa-v5-owner-spec-2026-07-07.md)_
- **[P3]** Одна миграция-чистка Stage-2 значений из enum'ов: pending_ban, revoked, pending_remoderation, hidden, hidden_by_user, requires_clarification/escalated, 4 soft-sanction. Внимание: escalated/requires_clarification РЕАЛЬНО достижимы через admin ALLOWED (decision/route.ts:10). _(src:audit-mvp-vs-spec SYS-003/009/010/011/012/014/015 (собрано, fix #20))_

## D. Незавершённое — ЮР-контур / внешнее (не строим сейчас)

- **[P0·external]** Надёжное планирование housekeeping-крона (SLA-reclaim брошенных verification_cases) и будущего backup-крона. В репо нет расписания ни для housekeeping, ни для backup. _(src:launch-readiness Cluster F/C (OPS-04, INFRA-06); p0-plan VER-5/SEC-4a)_
- **[P1·external]** Observability провязан кодом (Sentry register+onRequestError+tunnel, 5xx counter, /api/metrics), но инертен без SENTRY_DSN env и без внешнего uptime-монитора на /api/health. _(src:launch-readiness Cluster G (INFRA-02); p0-plan OBS-1/OBS-3)_
- **[P0·legal]** Отдельное согласие на чувствительные/специальные ПД (finance/lifestyle/health) перед их сбором в mini-app: экран consent-sensitive + consent-photos, шаг в стейт-машине, запись в consents с categories. LC-1 миграция и record_consent RPC есть, но фича НЕ провязана. _(src:audit-mvp-vs-spec-2026-07-01.md (LEGAL-006/007/008); launch-readiness Cluster A; p0-plan LC-3/4/5)_
- **[P1·legal]** Удаление данных (erase_user) — жёсткий немедленный DELETE без матрицы хранения (retain-for-payments / retain-for-complaints / legal-disputes; минимальное окно селфи/доков; обезличивание вместо удаления для матчинга). _(src:audit-mvp-vs-spec LEGAL-023/024)_
- **[P2·legal]** Отсутствуют обязательные регистрационные PDF: Data Storage & Deletion Policy, sensitive-consent, photo-consent, identity-consent, Communication/Photo/Complaints Rules. _(src:audit-mvp-vs-spec LEGAL-013)_
- **[P2·legal]** §2 Дети структурированно — массив children[] {gender, age_or_range, lives_with} + CHILD_GENDER/CHILD_LIVES_WITH _(src:anketa-v5-owner-spec-2026-07-07.md)_
- **[P2·legal]** §5 Возможность иметь детей (CHILDREN_CAPABILITY, смягчённая формулировка) _(src:anketa-v5-owner-spec-2026-07-07.md)_
- **[P2·legal]** §10 Родители и семья (БОЛЬШОЙ новый блок): jsonb parents{father,mother,marital,relationship,marriage_involvement} + ~4 enum + новый экран _(src:anketa-v5-owner-spec-2026-07-07.md)_
- **[P2·legal]** Ось 2 (религия) — ranking за фиче-флагом + явным согласием + legal sign-off _(src:matching-audit-2026-07-04.md)_
- **[P2·legal]** A1 (Родители) / A3 (дети структурированно) / A4 (health «не могу иметь детей») — заблокированы правовым контуром _(src:owner-feedback-plan-2026-07-07.md)_
- **[P2·legal]** B5 — семейное фото: политика + фильтр во всех read-сайтах (mini.ts, post-mutual, админка) _(src:owner-feedback-plan-2026-07-07.md)_
- **[P2·legal]** #82 / Экран 11 — Родители и семейная среда (12-13 полей, cold в extended.parents) _(src:task: deferred v4.1)_
- **[P2·legal]** #83 / Экран 13 — Здоровье и особенности _(src:task: deferred v4.1)_