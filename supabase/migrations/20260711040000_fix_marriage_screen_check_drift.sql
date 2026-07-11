-- Фикс live-бага (найден bug-hunt-агентом + подтверждён): options.ts/форма Экрана
-- «Готовность к браку» (marriage) предлагают значения, которых НЕТ в CHECK-констрейнтах
-- из anketa_v5_wave_a (20260707120000). Юзер выбирает обычную опцию (within_2y /
-- when_right / not_ready / na / city / country) → 23514 → route 500 → анкету НЕ пройти.
-- Это блокировало онбординг реальных юзеров на проде.
--
-- Emergency-unblock: РАСШИРЯЕМ каждый CHECK до ОБЪЕДИНЕНИЯ (v5-значения + значения,
-- которые реально отдаёт форма). Аддитивно, обратимо, поведение формы не меняется.
-- Дизайн-развилка (принять v5-набор и обрезать options, ИЛИ оставить options и убрать
-- неиспользуемые v5-значения) — отдельное решение оунера; здесь только снимаем 500.

-- marriage_readiness: v5(within_3m,within_6m,within_1y,no_rush,unsure) ∪ options(within_2y,when_right,not_ready,na)
alter table user_profiles drop constraint if exists user_profiles_marriage_readiness_chk;
alter table user_profiles add constraint user_profiles_marriage_readiness_chk check (
  marriage_readiness is null or marriage_readiness in (
    'within_3m','within_6m','within_1y','no_rush','unsure',
    'within_2y','when_right','not_ready','na'
  )
);

-- relocation_readiness: v5(ready,only_my_city,by_agreement,unsure) ∪ options(city,country,na)
alter table user_profiles drop constraint if exists user_profiles_relocation_readiness_chk;
alter table user_profiles add constraint user_profiles_relocation_readiness_chk check (
  relocation_readiness is null or relocation_readiness in (
    'ready','only_my_city','by_agreement','unsure',
    'city','country','na'
  )
);

-- post_marriage_living: текущий CHECK ∪ options('na')
alter table user_profiles drop constraint if exists user_profiles_post_marriage_living;
alter table user_profiles add constraint user_profiles_post_marriage_living check (
  post_marriage_living is null or post_marriage_living in (
    'with_husband_family','with_wife_family','separate','separate_near',
    'open_to_discuss','temporary_then_separate','unsure','na'
  )
);
