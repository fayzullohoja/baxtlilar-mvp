-- i18n ENABLE (2026-07-11, решение оунера «выкатить TR»): добавляем 'tr' в
-- допустимые значения users.language. Инлайновый users_language_check из init
-- допускал только ('ru','uz') → выбор TR в боте падал бы по constraint.
-- Идемпотентно (drop if exists → recreate). Применяется вместе с routing.locales+=tr,
-- messages/tr.json и TR-кнопкой бота.

alter table users drop constraint if exists users_language_check;
alter table users
  add constraint users_language_check check (language in ('ru', 'uz', 'tr'));
