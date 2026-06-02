-- B3 (аудит): список диалогов и счётчик непрочитанных скрывают чаты, где есть блокировка
-- в любую сторону (взаимное скрытие).
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
  where (c.user_a = p_user or c.user_b = p_user)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_user and b.blocked_id in (c.user_a, c.user_b))
         or (b.blocked_id = p_user and b.blocker_id in (c.user_a, c.user_b))
    )
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
    and m.read_at is null
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_user and b.blocked_id in (c.user_a, c.user_b))
         or (b.blocked_id = p_user and b.blocker_id in (c.user_a, c.user_b))
    );
$$;
