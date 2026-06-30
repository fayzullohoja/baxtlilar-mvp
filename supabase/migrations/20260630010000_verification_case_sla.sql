-- 20260630010000_verification_case_sla.sql
-- Bug #11 (E2E loop pass 2): нет SLA для застрявших cases. Если модератор взял
-- кейс и абандонил (отпуск, увольнение), кейс не виден в /admin/queue/mine у
-- других модераторов (assignee_id != null) И не виден в /admin/queue/unassigned
-- (state != 'new'). Юзер навсегда в pending_review.
--
-- Решение: RPC, которая возвращает кейсы заброшенные дольше 7 дней в state='new'
-- и снимает assignee. Вызывается из /api/cron/housekeeping.
--
-- Не делаем auto-reject: это требует policy-решение (продукт). Только re-queue.

create or replace function admin_sla_reclaim_stale_cases(p_max_idle_hours integer default 168)
  returns table(reclaimed_id uuid, prev_state text, prev_assignee uuid, idle_hours numeric)
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $$
begin
  return query
  with stale as (
    select
      id,
      state::text as prev_state,
      assignee_id as prev_assignee,
      extract(epoch from (now() - updated_at)) / 3600 as idle_hours
    from verification_cases
    where state in ('assigned', 'in_review', 'data_entry', 'ready_to_decide')
      and updated_at < now() - make_interval(hours => p_max_idle_hours)
  ),
  updated as (
    update verification_cases vc
    set state = 'new',
        assignee_id = null,
        claimed_at = null
    from stale s
    where vc.id = s.id
    returning vc.id
  )
  select s.id, s.prev_state, s.prev_assignee, round(s.idle_hours::numeric, 1)
  from stale s
  join updated u on u.id = s.id;
end;
$$;

-- Append-only audit того, что RPC сделала. Запись в case_events идёт отдельно
-- из application-кода (RPC не имеет admin_id контекста для actor_id).

do $$ begin raise notice 'SLA reclaim RPC ready. Call from /api/cron/housekeeping.'; end $$;
