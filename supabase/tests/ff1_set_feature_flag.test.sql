-- C-033: set_feature_flag — вайтлист имён фич + upsert флага в app_settings.
begin;
set local search_path = public;

delete from app_settings where key like 'feature_%_enabled';

-- включаем/выключаем валидные фичи
select set_feature_flag(null, 'interests', false);
select set_feature_flag(null, 'payments', true);

do $$
begin
  assert (select value from app_settings where key = 'feature_interests_enabled') = 'false'::jsonb,
    'interests должен быть false';
  assert (select value from app_settings where key = 'feature_payments_enabled') = 'true'::jsonb,
    'payments должен быть true';

  -- upsert перезаписывает то же значение
  perform set_feature_flag(null, 'interests', true);
  assert (select value from app_settings where key = 'feature_interests_enabled') = 'true'::jsonb,
    'upsert должен перезаписать interests в true';
end $$;

-- неизвестная фича отклоняется (не создаёт ключ)
do $$
declare raised boolean := false;
begin
  begin
    perform set_feature_flag(null, 'evil_feature', false);
  exception when others then raised := true;
  end;
  assert raised, 'неизвестная фича должна бросать исключение';
  assert not exists (select 1 from app_settings where key = 'feature_evil_feature_enabled'),
    'мусорный ключ не должен попасть в стор';
end $$;

-- null enabled отклоняется
do $$
declare raised boolean := false;
begin
  begin
    perform set_feature_flag(null, 'chat', null);
  exception when others then raised := true;
  end;
  assert raised, 'null enabled должен бросать исключение';
end $$;

delete from app_settings where key like 'feature_%_enabled';
rollback;

do $$ begin raise notice '✓ ff1 set_feature_flag whitelist+upsert OK'; end $$;
