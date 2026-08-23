-- Находка аудита: очередь уведомлений росла линейно и без потолка.
--
-- Строка попадает в tg_outbox на каждое событие (интерес, взаимность,
-- сообщение, решение модератора) и не удаляется НИКОГДА - ни доставленная, ни
-- мёртвая. Доставленные это чистый балласт: их уже отправили, и claim их
-- больше не видит (условие sent_at is null). Мёртвые - те, у кого attempts
-- дошли до 5 - тоже не поедут никогда, но их полезно подержать: это сигнал,
-- что до кого-то не достучались.
--
-- Поэтому два разных срока: доставленные чистим через 30 дней, мёртвые держим
-- 90 - достаточно, чтобы их заметили в витрине здоровья очереди, и всё же не
-- вечно.
create or replace function public.gc_tg_outbox()
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sent integer;
  v_dead integer;
begin
  with d as (
    delete from tg_outbox
     where sent_at is not null
       and sent_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_sent from d;

  with d as (
    delete from tg_outbox
     where sent_at is null
       and attempts >= 5
       and created_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into v_dead from d;

  return jsonb_build_object('deleted_sent', v_sent, 'deleted_dead', v_dead);
end;
$function$;

comment on function public.gc_tg_outbox() is
  'Ретенция очереди уведомлений: доставленные старше 30 дней и окончательно мёртвые (attempts>=5) старше 90 дней. Зовётся кроном housekeeping.';
