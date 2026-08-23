-- Находка аудита 23.08.2026: CHECK на post_marriage_living разошёлся с тем, что
-- предлагает интерфейс.
--
-- В options.ts есть вариант 'separate_then_parents' («сначала отдельно, потом с
-- родителями»), zod его пропускает, а CHECK - нет. Человек выбирает его на шаге
-- «Жизнь после брака», жмёт «Далее» и получает 500: роут отдаёт save_failed,
-- пройти шаг невозможно, поле обязательное. Воспроизведено на копии базы:
-- update отдаёт "violates check constraint user_profiles_post_marriage_living".
--
-- Значения 'separate_near' и 'na' в CHECK остаются, хотя интерфейс их больше не
-- предлагает: у части людей они уже записаны (в частности 'na' - до удаления
-- варианта «не хочу отвечать» коммитом 6041878), и сузить список означало бы
-- сломать сохранение их анкет при любой последующей правке.
alter table public.user_profiles
  drop constraint if exists user_profiles_post_marriage_living;

alter table public.user_profiles
  add constraint user_profiles_post_marriage_living
  check (
    post_marriage_living is null
    or post_marriage_living = any (array[
      'with_husband_family',
      'with_wife_family',
      'separate',
      'separate_near',
      'separate_then_parents',
      'open_to_discuss',
      'temporary_then_separate',
      'unsure',
      'na'
    ]::text[])
  );
