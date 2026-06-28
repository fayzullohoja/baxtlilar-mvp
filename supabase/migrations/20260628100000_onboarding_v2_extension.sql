-- Onboarding V2 Extension — продуктовые поправки 2026-06-28.
-- Источник: встреча учредителя с продакт-командой.
--
-- 1. Welcome серия из 3 экранов перед verify → 2 новых шага в enum
--    (welcome_safety, welcome_rules). Существующий welcome_step добавляется как
--    welcome_mission для явности (если нет — добавляем).
-- 2. Гражданство + страна проживания + регион → 3 колонки в user_profiles.
-- 3. Демография — рост/вес/языки → 3 колонки + reuse существующего languages[].
-- 4. Религия — religion_practice + religion_partner_match (заменяют
--    religion_importance 1-5 шкалу; старая колонка остаётся nullable для legacy).
-- 5. Формат проживания после брака → 1 колонка + 1 шаг в enum.
--
-- Идемпотентно: IF NOT EXISTS / ADD VALUE IF NOT EXISTS / DO blocks.

-- ============ 1. ENUM extensions ============

alter type onboarding_step add value if not exists 'welcome_mission';
alter type onboarding_step add value if not exists 'welcome_safety';
alter type onboarding_step add value if not exists 'welcome_rules';
alter type onboarding_step add value if not exists 'profile_appearance';
alter type onboarding_step add value if not exists 'profile_marriage';

-- ============ 2. user_profiles new columns ============

alter table user_profiles
  add column if not exists citizenship text,
  add column if not exists country_of_residence text,
  add column if not exists region text,
  add column if not exists height_cm integer,
  add column if not exists weight_kg integer,
  add column if not exists native_language text,
  add column if not exists religion_practice text,
  add column if not exists religion_partner_match text,
  add column if not exists post_marriage_living text;

-- Check constraints (отдельно от ADD COLUMN — Postgres не допускает inline в одном ALTER)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_height_range'
  ) then
    alter table user_profiles
      add constraint user_profiles_height_range
      check (height_cm is null or (height_cm between 140 and 220));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_weight_range'
  ) then
    alter table user_profiles
      add constraint user_profiles_weight_range
      check (weight_kg is null or (weight_kg between 35 and 200));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_religion_practice'
  ) then
    alter table user_profiles
      add constraint user_profiles_religion_practice
      check (religion_practice is null or religion_practice in (
        'observant', 'striving', 'cultural', 'not_practicing'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_religion_partner_match'
  ) then
    alter table user_profiles
      add constraint user_profiles_religion_partner_match
      check (religion_partner_match is null or religion_partner_match in (
        'same_religion_same_practice', 'same_religion', 'mutual_respect'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_post_marriage_living'
  ) then
    alter table user_profiles
      add constraint user_profiles_post_marriage_living
      check (post_marriage_living is null or post_marriage_living in (
        'with_husband_family', 'with_wife_family', 'separate', 'separate_near', 'open_to_discuss'
      ));
  end if;
end$$;

comment on column user_profiles.citizenship is 'Гражданство (UZ/RU/KZ/...). Собирается в анкете, при approve паспорта сверяется с user_identity.citizenship.';
comment on column user_profiles.country_of_residence is 'Страна фактического проживания (может отличаться от citizenship).';
comment on column user_profiles.region is 'Регион/область внутри страны. Для UZ — из UZ-классификатора, для остальных — текст.';
comment on column user_profiles.height_cm is 'Рост, см. 140-220.';
comment on column user_profiles.weight_kg is 'Вес, кг. 35-200. Optional — soft поле для anti-drop-off.';
comment on column user_profiles.native_language is 'Родной язык (один из LANGUAGES_LIST).';
comment on column user_profiles.religion_practice is 'Как практикует: observant/striving/cultural/not_practicing. Заменяет religion_importance 1-5 шкалу (которая создавала ложное позиционирование).';
comment on column user_profiles.religion_partner_match is 'Желание у партнёра по религии: same_religion_same_practice/same_religion/mutual_respect. Optional.';
comment on column user_profiles.post_marriage_living is 'Формат проживания после брака: with_husband_family/with_wife_family/separate/separate_near/open_to_discuss.';
