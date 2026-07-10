-- 20260711000000_attribution_add_influencer.sql
-- Ревью оунера 2026-07-10 (Экран attribution): добавить канал «Блогер / influencer».
-- Additive: пересоздаём CHECK со старым списком + новое значение 'influencer'.
-- Идемпотентно (drop if exists + recreate).

alter table users
  drop constraint if exists users_attribution_source_check;
alter table users
  add constraint users_attribution_source_check
  check (
    attribution_source is null
    or attribution_source in (
      'telegram',
      'instagram',
      'friends',
      'facebook',
      'tiktok',
      'youtube',
      'ads',
      'search',
      'media',
      'event',
      'influencer',
      'other'
    )
  );
