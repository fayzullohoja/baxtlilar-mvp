-- C-026 — атомарный accept интереса кнопкой.
--
-- Было: роут делал 3 отдельных round-trip'а (UPDATE status='accepted' →
-- ensureChat() insert → enqueueAndDeliver()). Неатомарно: краш между шагами
-- оставлял заявку 'accepted' без чата (рукописный откат ловил только throw
-- ensureChat, не краш), а enqueue после коммита терял уведомление (dual-write).
--
-- Стало: единая RPC — лок пары + статус + чат + enqueue tg_outbox в ОДНОЙ
-- транзакции. Тот же advisory-лок пары и порядок ключей (least,greatest), что в
-- process_interest → сериализация встречного mutual и accept без дедлока и без
-- второго чата. «Один чат на пару» и так гарантирован (unique chats_pair +
-- check user_a<user_b); здесь добавляем АТОМАРНОСТЬ mutual для явного accept.
--
-- Доставка (Bot API) остаётся в приложении: RPC возвращает outbox_id, роут зовёт
-- tryDeliverNow (best-effort); cron tg-outbox — retry-safe фолбэк.

create or replace function accept_interest(p_request uuid, p_receiver uuid)
returns table (result text, chat_id uuid, outbox_id uuid)
language plpgsql
as $$
declare
  v_sender uuid;
  v_receiver uuid;
  v_status text;
  v_expire timestamptz;
  v_a uuid;
  v_b uuid;
  v_chat uuid;
  v_outbox uuid;
  v_updated int;
begin
  -- Заявку читаем БЕЗ row-lock: sender/receiver immutable — нужны лишь чтобы
  -- вычислить пару, провалидировать authz и быстро отсеять очевидные случаи.
  -- КРИТИЧНО (порядок локов): advisory-лок пары берём ПЕРВЫМ, ДО любого
  -- FOR UPDATE — ровно как process_interest (advisory→row). Обратный порядок
  -- (row→advisory) даёт ABBA-дедлок между accept и встречным process_interest
  -- на той же паре (B жмёт «принять» A и одновременно шлёт интерес A). Поэтому
  -- здесь FOR UPDATE НЕТ вообще: атомарность даёт условный UPDATE под advisory.
  select sender_id, receiver_id, status::text, auto_decline_at
    into v_sender, v_receiver, v_status, v_expire
    from match_requests where id = p_request;
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;
  -- authz: принимает ТОЛЬКО получатель (defense-in-depth к роут-гейту)
  if v_receiver <> p_receiver then
    return query select 'forbidden'::text, null::uuid, null::uuid;
    return;
  end if;
  if v_status <> 'pending' then
    return query select 'not_pending'::text, null::uuid, null::uuid;
    return;
  end if;
  if v_expire <= now() then
    update match_requests set status = 'expired' where id = p_request and status = 'pending';
    return query select 'expired'::text, null::uuid, null::uuid;
    return;
  end if;

  v_a := least(v_sender, v_receiver);
  v_b := greatest(v_sender, v_receiver);
  -- ЛОК ПАРЫ ПЕРВЫМ (advisory→row), единый порядок с process_interest.
  perform pg_advisory_xact_lock(hashtext(v_a::text), hashtext(v_b::text));

  -- Условный UPDATE = атомарный переход pending→accepted под advisory-локом.
  update match_requests set status = 'accepted' where id = p_request and status = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Пока брали лок, кто-то опередил: встречный process_interest принял ту же
    -- пару, или повторный accept. Если уже 'accepted' — идемпотентно отдаём
    -- существующий чат БЕЗ второго уведомления; иначе (declined/withdrawn/
    -- expired) — not_pending.
    if (select status::text from match_requests where id = p_request) <> 'accepted' then
      return query select 'not_pending'::text, null::uuid, null::uuid;
      return;
    end if;
  end if;

  -- один чат на пару (canonical + unique chats_pair); гонку ловим on conflict
  insert into chats(user_a, user_b) values (v_a, v_b)
    on conflict (user_a, user_b) do nothing returning id into v_chat;
  if v_chat is null then
    select id into v_chat from chats where user_a = v_a and user_b = v_b;
  end if;

  -- уведомление отправителю ровно РАЗ — только когда именно мы приняли заявку
  -- (v_updated=1). На повторе/гонке outbox_id = null.
  if v_updated = 1 then
    v_outbox := enqueue_tg_outbox(v_sender, 'interest_accepted', '{}'::jsonb);
  end if;

  return query select 'accepted'::text, v_chat, v_outbox;
end $$;

do $$ begin raise notice 'C-026 accept_interest atomic RPC ready.'; end $$;
