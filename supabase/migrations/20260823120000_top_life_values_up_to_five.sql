-- Family launch 2026-08 (замечание 2 тестеров): потолок ценностей поднят с 3 до 5.
--
-- Правка в zod-схеме и в интерфейсе без этой миграции - ловушка: клиент и схема
-- пропустили бы четыре-пять значений, а запись упала бы на CHECK из
-- 20260629000000_anketa_v3_hybrid, и человек увидел бы 500 на ровном месте.
-- Воспроизведено на копии базы: update с пятью значениями отдаёт
-- "violates check constraint user_profiles_top_life_values_len_chk".
--
-- Ограничение снизу (>= 1) сохраняем: пустой список означал бы, что человек не
-- ответил, а вопрос обязательный. Верхнюю границу двигаем до 5 - столько же
-- разрешает Chips на экране и zod.
alter table public.user_profiles
  drop constraint if exists user_profiles_top_life_values_len_chk;

alter table public.user_profiles
  add constraint user_profiles_top_life_values_len_chk
  check (
    array_length(top_life_values, 1) is null
    or (array_length(top_life_values, 1) >= 1 and array_length(top_life_values, 1) <= 5)
  );

-- Расширение диапазона обратно совместимо: все существующие строки (1..3)
-- проходят новый CHECK, переписывать данные не требуется.
