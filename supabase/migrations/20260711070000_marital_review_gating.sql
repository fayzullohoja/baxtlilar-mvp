-- Ревью оунера F4: профили с «чувствительным» семейным положением
-- (В процессе развода / В браке, но живу отдельно — см. MARITAL_STATUS_NEEDS_REVIEW
-- в src/lib/profile/options.ts) должны попадать в поле зрения модератора.
--
-- МИНИМАЛЬНЫЙ безопасный контур (не ломает publish→quiz, не заводит второй тип
-- очереди): additive nullable-флаг, который выставляется в true при публикации,
-- если marital_status входит в needs-review список. Профиль публикуется обычным
-- образом (status='published', виден в подборе через is_matchable) — флаг лишь
-- поднимает его для асинхронного просмотра оператором.
--
-- ВАЖНО: это НЕ pre-publish гейт (профиль остаётся видимым). Полноценная
-- блокировка до ревью требует операторского UI одобрения (координация с
-- admin-wave). Здесь мы только помечаем.
alter table user_profiles
  add column if not exists needs_marital_review boolean not null default false;

comment on column user_profiles.needs_marital_review is
  'F4: true, если marital_status ∈ (divorcing, married_separate) на момент публикации. Флаг для операторского контент-ревью (не гейтит видимость).';

-- Индекс для дашборд-фильтра «профили на контент-ревью».
create index if not exists idx_user_profiles_marital_review
  on user_profiles (needs_marital_review, status)
  where needs_marital_review = true;
