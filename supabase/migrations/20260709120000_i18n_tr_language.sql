-- i18n: добавляем турецкий (tr) в допустимые значения users.language.
-- Инлайновый CHECK из init_schema (users_language_check) допускал только ('ru','uz'),
-- поэтому при выборе TR в боте UPDATE users SET language='tr' падал бы по constraint.
--
-- ⚠️ ENABLE-шаг: применять на прод ТОЛЬКО когда TR включается публично
-- (routing.locales += 'tr' + кнопка TR в боте), т.е. после ревью носителя.
-- Безопасно и идемпотентно (drop if exists → recreate).

alter table users drop constraint if exists users_language_check;
alter table users
  add constraint users_language_check check (language in ('ru', 'uz', 'tr'));
