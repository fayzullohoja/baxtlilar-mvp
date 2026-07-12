-- Волна 7 Фаза 3: set_app_settings — вайтлист ключей + upsert.
do $$
begin
  delete from app_settings;
  perform set_app_settings(null, jsonb_build_object(
    'banner_on', true, 'banner_text', 'hi', 'sla_warn_hours', 48, 'evil_key', 'x'));

  assert (select value from app_settings where key = 'banner_on') = 'true'::jsonb, 'banner_on stored';
  assert (select value from app_settings where key = 'sla_warn_hours') = '48'::jsonb, 'sla stored';
  assert not exists (select 1 from app_settings where key = 'evil_key'), 'whitelist must reject evil_key';

  -- upsert перезаписывает
  perform set_app_settings(null, jsonb_build_object('banner_on', false));
  assert (select value from app_settings where key = 'banner_on') = 'false'::jsonb, 'upsert overwrites';

  delete from app_settings;
  raise notice '✓ app_settings whitelist+upsert OK';
end$$;
