-- =============================================================================
-- Фаза 4 (§1.20) — страховка для in-flight юзеров при переносе preview в конец.
--
-- Порядок хвоста онбординга изменён (см. commit Фазы 4):
--   было:  photos → preview[publish] → quiz → attribution → tutorial
--   стало: photos → quiz → attribution → preview[publish] → tutorial
--
-- Риск деплой-тайминга (adversarial-review F1): юзер, СИДЯЩИЙ на старом
-- profile_preview (до publish, до quiz) в момент выката, под новым кодом нажмёт
-- «Опубликовать» → publish ведёт СРАЗУ в tutorial_intro, и он НАВСЕГДА пропустит
-- Big Five (пустой вектор → деградация мэтчинга; НЕ обход publish-гейта — gender/
-- фото/полнота остаются). Переносим таких стрэгглеров обратно на quiz: под новым
-- кодом quiz → attribution → preview → publish → tutorial (гейт соблюдён).
--
-- ⚠ ПРИМЕНЯТЬ ПОСЛЕ ВЫКАТА КОДА (в отличие от enum-миграций). Под СТАРЫМ кодом
-- перенос preview→quiz увёл бы юзера в quiz→attribution→tutorial МИМО publish.
-- Идемпотентна; на чистой/актуальной БД — no-op (0 строк).
--
-- IS DISTINCT FROM ловит и NULL, и любое не-'completed' значение quiz_completion.
-- Новые (после reorder) preview-юзеры имеют quiz_completion='completed' → НЕ трогаем.
-- =============================================================================

UPDATE users
SET onboarding_step = 'quiz'
WHERE lifecycle_state = 'onboarding'
  AND onboarding_step = 'profile_preview'
  AND quiz_completion IS DISTINCT FROM 'completed';
