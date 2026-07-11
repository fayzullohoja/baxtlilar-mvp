-- Ревью оунера — реализация gap-батча.
-- 1) Экран 5: future_children_plan += 'individual' («обсуждается индивидуально»). Additive.
alter table user_profiles drop constraint if exists user_profiles_future_children_plan_chk;
alter table user_profiles add constraint user_profiles_future_children_plan_chk check (
  future_children_plan is null or future_children_plan in (
    'yes_soon','yes_later','maybe','no','with_partner_decide','individual'
  )
);

-- 2) Экран 13/14: privacy-default профиля = verified_only (в рекомендациях анкету
--    видят только проверенные юзеры). Раньше дефолт был 'public'. Меняем только
--    DEFAULT для новых строк; существующие не трогаем (их и нет — БД чистая).
alter table user_profiles alter column profile_visibility_mode set default 'verified_only';

-- marital_status: divorcing/married_separate — колонка text без CHECK, миграция не нужна.
-- children_living / specialty / activity_field_other / other_language — cold (extended), без колонок.
