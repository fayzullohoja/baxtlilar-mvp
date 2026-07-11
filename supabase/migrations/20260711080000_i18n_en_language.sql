-- i18n ENABLE (2026-07-11, решение оунера «выкатить EN как есть»): добавляем 'en'
-- в допустимые значения users.language. Аналогично 20260711050000 (TR): без этого
-- выбор English в боте падал бы по users_language_check.
alter table users drop constraint if exists users_language_check;
alter table users
  add constraint users_language_check check (language in ('ru', 'uz', 'tr', 'en'));
