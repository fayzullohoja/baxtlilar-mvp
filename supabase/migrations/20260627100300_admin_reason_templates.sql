-- Phase A.4: editable reason templates. Sprint 4 will add UI editor; Sprint 1
-- just seeds verification (used in Sprint 1 decision UI) and photo (used in Sprint 2).

create table if not exists admin_reason_templates (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('verification','photo','report')),
  lang        text not null check (lang in ('ru','uz')),
  code        text not null,
  text        text not null,
  sort        int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (scope, lang, code)
);

insert into admin_reason_templates (scope, lang, code, text, sort) values
  -- verification, ru (используется DecisionPanel в Sprint 1)
  ('verification','ru','blurry_passport','Скан паспорта размыт — нужен чёткий снимок',10),
  ('verification','ru','blurry_selfie','Селфи размыто — переснимите при дневном свете',20),
  ('verification','ru','face_not_visible','Лицо на селфи закрыто — снимите без головного убора',30),
  ('verification','ru','passport_glare','Блики на паспорте — снимите без вспышки',40),
  ('verification','ru','wrong_document','Прислан другой документ — требуется паспорт UZ',50),
  ('verification','ru','data_mismatch','Данные на скане не читаются — переснимите',60),
  -- verification, uz
  ('verification','uz','blurry_passport','Pasport skani aniq emas — aniqroq surat kerak',10),
  ('verification','uz','blurry_selfie','Selfie aniq emas — kunduzgi yorug''likda qayta suratga oling',20),
  ('verification','uz','face_not_visible','Selfida yuz ko''rinmayapti — bosh kiyimsiz suratga oling',30),
  ('verification','uz','passport_glare','Pasportda yorug''lik aks etgan — vspishkasiz suratga oling',40),
  ('verification','uz','wrong_document','Boshqa hujjat yuborilgan — UZ pasporti talab qilinadi',50),
  ('verification','uz','data_mismatch','Skandagi ma''lumotlar o''qilmaydi — qayta suratga oling',60),
  -- photo, ru (используется Sprint 2 PhotosTable)
  ('photo','ru','low_quality','Низкое качество (размыто / тёмно)',10),
  ('photo','ru','face_hidden','Лицо не видно / закрыто',20),
  ('photo','ru','multiple_people','Несколько людей на фото',30),
  ('photo','ru','not_the_person','Не тот человек, что в селфи',40),
  ('photo','ru','inappropriate','Неуместный контент',50),
  ('photo','ru','duplicate','Дубликат предыдущего фото',60),
  -- photo, uz
  ('photo','uz','low_quality','Sifati past (aniq emas / qorong''u)',10),
  ('photo','uz','face_hidden','Yuz ko''rinmayapti / yopilgan',20),
  ('photo','uz','multiple_people','Suratda bir necha kishi',30),
  ('photo','uz','not_the_person','Selfidagi shaxs emas',40),
  ('photo','uz','inappropriate','Nomaqbul mazmun',50),
  ('photo','uz','duplicate','Avvalgi suratning dublikati',60)
on conflict (scope, lang, code) do nothing;
