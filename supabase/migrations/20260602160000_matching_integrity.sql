-- Фаза 1 / Группа A (аудит): атомарность квоты и взаимного матча, истечение pending в ленте,
-- анти-повтор интереса после отказа. Граница суток квоты — по Asia/Tashkent.

-- M10/M45/M62: атомарный инкремент дневной квоты. true = разрешено (увеличили), false = лимит.
create or replace function bump_quota(p_user uuid, p_kind text, p_limit int)
returns boolean
language plpgsql
as $$
declare
  v_day date := (now() at time zone 'Asia/Tashkent')::date;
  v_new int;
begin
  insert into daily_request_quotas(user_id, on_date) values (p_user, v_day)
  on conflict (user_id, on_date) do nothing;

  if p_kind = 'interests' then
    update daily_request_quotas set interests_sent = interests_sent + 1
      where user_id = p_user and on_date = v_day and interests_sent < p_limit
      returning interests_sent into v_new;
  elsif p_kind = 'views' then
    update daily_request_quotas set views_count = views_count + 1
      where user_id = p_user and on_date = v_day and views_count < p_limit
      returning views_count into v_new;
  else
    return false;
  end if;

  return v_new is not null;
end $$;

-- M14/M44: вся логика интереса атомарно под advisory-локом нормализованной пары.
-- Возвращает result: 'mutual' | 'already_sent' | 'declined_block' | 'daily_limit' | 'sent'.
create or replace function process_interest(
  p_sender uuid,
  p_receiver uuid,
  p_message text,
  p_hours int,
  p_limit int
)
returns table (result text, chat_id uuid)
language plpgsql
as $$
declare
  v_a uuid := least(p_sender, p_receiver);
  v_b uuid := greatest(p_sender, p_receiver);
  v_rev uuid;
  v_chat uuid;
begin
  -- сериализуем встречные A->B и B->A
  perform pg_advisory_xact_lock(hashtext(v_a::text || v_b::text)::bigint);

  -- встречный живой pending → взаимный интерес: принять + открыть чат
  select id into v_rev from match_requests
    where sender_id = p_receiver and receiver_id = p_sender
      and status = 'pending' and auto_decline_at > now()
    for update;
  if found then
    update match_requests set status = 'accepted' where id = v_rev;
    select id into v_chat from chats where user_a = v_a and user_b = v_b;
    if v_chat is null then
      insert into chats(user_a, user_b) values (v_a, v_b)
        on conflict (user_a, user_b) do nothing returning id into v_chat;
      if v_chat is null then select id into v_chat from chats where user_a = v_a and user_b = v_b; end if;
    end if;
    return query select 'mutual'::text, v_chat;
    return;
  end if;

  -- получатель уже отказал отправителю → не даём слать снова (анти-харассмент)
  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver and status = 'declined') then
    return query select 'declined_block'::text, null::uuid;
    return;
  end if;

  -- уже есть активная заявка отправитель→получатель (принятая или живой pending)
  if exists (select 1 from match_requests
               where sender_id = p_sender and receiver_id = p_receiver
                 and (status = 'accepted' or (status = 'pending' and auto_decline_at > now()))) then
    return query select 'already_sent'::text, null::uuid;
    return;
  end if;

  -- дневная квота
  if not bump_quota(p_sender, 'interests', p_limit) then
    return query select 'daily_limit'::text, null::uuid;
    return;
  end if;

  insert into match_requests(sender_id, receiver_id, message, auto_decline_at)
    values (p_sender, p_receiver, p_message, now() + make_interval(hours => p_hours));
  return query select 'sent'::text, null::uuid;
end $$;

-- M12/M13: лента не прячет людей из-за ИСТЁКШИХ pending; отказавший кандидат не показывается.
create or replace function get_recommendations(p_viewer uuid, p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  age int,
  city text,
  vals text[],
  vector jsonb,
  main_photo_path text
)
language sql
stable
as $$
  with v as (
    select u.id, vp.gender, vp.looking_for_gender, vp.city, vp.values as vals,
           date_part('year', age(vp.birth_date))::int as age,
           vp.partner_age_min, vp.partner_age_max
    from users u
    join user_profiles vp on vp.user_id = u.id
    where u.id = p_viewer
  )
  select c.id, cp.display_name,
         date_part('year', age(cp.birth_date))::int as age,
         cp.city, cp.values as vals,
         coalesce(cq.vector, '{}'::jsonb) as vector,
         (select pp.path from profile_photos pp
            where pp.user_id = c.id and pp.status = 'approved'
            order by pp.is_main desc, pp.ord asc limit 1) as main_photo_path
  from users c
  join user_profiles cp on cp.user_id = c.id
  left join quiz_results cq on cq.user_id = c.id
  cross join v
  where c.id <> p_viewer
    and c.lifecycle_state = 'active'
    and c.verification_status = 'approved'
    and cp.status = 'published'
    and cp.gender = v.looking_for_gender
    and v.gender = cp.looking_for_gender
    and date_part('year', age(cp.birth_date))::int between v.partner_age_min and v.partner_age_max
    and v.age between cp.partner_age_min and cp.partner_age_max
    and exists (select 1 from profile_photos pp where pp.user_id = c.id and pp.status = 'approved')
    and not exists (select 1 from match_views mv where mv.viewer_id = p_viewer and mv.target_id = c.id)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_viewer and b.blocked_id = c.id)
         or (b.blocker_id = c.id and b.blocked_id = p_viewer)
    )
    and not exists (
      select 1 from match_requests mr
      where (
              ((mr.sender_id = p_viewer and mr.receiver_id = c.id)
                or (mr.sender_id = c.id and mr.receiver_id = p_viewer))
              and (mr.status = 'accepted' or (mr.status = 'pending' and mr.auto_decline_at > now()))
            )
         or (mr.sender_id = p_viewer and mr.receiver_id = c.id and mr.status = 'declined')
    )
  limit p_limit;
$$;
