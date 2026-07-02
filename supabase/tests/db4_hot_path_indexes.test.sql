-- DB-4 — партиальные индексы существуют с правильным предикатом.
-- Харнесс грузит все миграции → индексы должны быть на месте. RAISE при отсутствии.

do $$
declare
  d text;
begin
  -- profile_photos: partial по approved
  select pg_get_indexdef(i.indexrelid) into d
  from pg_index i join pg_class c on c.oid = i.indexrelid
  where c.relname = 'profile_photos_user_approved_idx';
  if d is null then
    raise exception 'DB-4: индекс profile_photos_user_approved_idx отсутствует';
  end if;
  if position('approved' in d) = 0 then
    raise exception 'DB-4: profile_photos индекс не партиальный по approved: %', d;
  end if;

  -- chat_messages: partial по unread
  select pg_get_indexdef(i.indexrelid) into d
  from pg_index i join pg_class c on c.oid = i.indexrelid
  where c.relname = 'chat_messages_unread_idx';
  if d is null then
    raise exception 'DB-4: индекс chat_messages_unread_idx отсутствует';
  end if;
  if position('read_at' in d) = 0 then
    raise exception 'DB-4: chat_messages индекс не партиальный по read_at: %', d;
  end if;

  raise notice 'DB-4 indexes: OK';
end $$;
