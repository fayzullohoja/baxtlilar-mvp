-- Anketa V5 Wave A (owner spec 2026-07-07).
--
-- Единственная колонка Волны A под CHECK — post_marriage_living. Расширяем
-- допустимый набор двумя значениями (temporary_then_separate, unsure).
-- Обратно-совместимо: старые значения остаются валидны; separate_near сохранён
-- в CHECK для legacy-данных (в UI не предлагается с V4).
--
-- citizenship / country_of_residence / education — text без CHECK, расширение их
-- списков живёт только в options.ts (zod) и миграции не требует.

alter table user_profiles drop constraint if exists user_profiles_post_marriage_living;

alter table user_profiles
  add constraint user_profiles_post_marriage_living
  check (post_marriage_living is null or post_marriage_living in (
    'with_husband_family', 'with_wife_family', 'separate', 'separate_near',
    'open_to_discuss', 'temporary_then_separate', 'unsure'
  ));

-- Модель семьи: 3 варианта (муж/жена/равное), убрано 'situational'.
-- Прод-данных с 'situational' — 0 (проверено), поэтому CHECK можно сузить без бэкфилла.
alter table user_profiles drop constraint if exists user_profiles_family_role_model_chk;

alter table user_profiles
  add constraint user_profiles_family_role_model_chk
  check (family_role_model is null or family_role_model in (
    'traditional', 'woman_leads', 'equal_partnership'
  ));
