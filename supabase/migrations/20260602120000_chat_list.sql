-- Список диалогов одним запросом: по каждому чату — собеседник, последнее сообщение,
-- его автор/время и число непрочитанных входящих. Плюс суммарный счётчик для бейджа навигации.
create or replace function get_chat_list(p_user uuid)
returns table (
  chat_id uuid,
  other_id uuid,
  last_body text,
  last_at timestamptz,
  last_sender uuid,
  unread int
)
language sql
stable
as $$
  select c.id,
         case when c.user_a = p_user then c.user_b else c.user_a end as other_id,
         lm.body,
         lm.created_at,
         lm.sender_id,
         coalesce(un.cnt, 0)::int as unread
  from chats c
  left join lateral (
    select body, created_at, sender_id
    from chat_messages m
    where m.chat_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt
    from chat_messages m
    where m.chat_id = c.id and m.sender_id <> p_user and m.read_at is null
  ) un on true
  where c.user_a = p_user or c.user_b = p_user
  order by coalesce(lm.created_at, c.created_at) desc
  limit 100;
$$;

create or replace function get_unread_total(p_user uuid)
returns int
language sql
stable
as $$
  select coalesce(count(*), 0)::int
  from chat_messages m
  join chats c on c.id = m.chat_id
  where (c.user_a = p_user or c.user_b = p_user)
    and m.sender_id <> p_user
    and m.read_at is null;
$$;
