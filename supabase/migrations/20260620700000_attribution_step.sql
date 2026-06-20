-- 20260620700000_attribution_step.sql
-- MAJOR #3 (spec Экран 12): источник привлечения. После квиза, перед active.
-- Аналитика каналов привлечения для PO.

alter type onboarding_step add value if not exists 'attribution';

alter table users
  add column if not exists attribution_source text null;

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
      'other'
    )
  );

create index if not exists users_attribution_source_idx
  on users(attribution_source)
  where attribution_source is not null;

comment on column users.attribution_source is
  'MAJOR #3: канал привлечения, выбранный юзером на /onboarding/attribution. NULL пока шаг не пройден или skip.';
