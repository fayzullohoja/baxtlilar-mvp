-- OBS-4 — get_ops_metrics(): DB-производные ops-метрики для /api/metrics
-- (глубина outbox + возраст самого старого + dead-letter; глубина очереди
-- верификации). Pool-статы и 5xx добавляет route (JS-side). Set-based, дёшево.

create or replace function get_ops_metrics()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'outbox', jsonb_build_object(
      'depth', (select count(*) from tg_outbox where sent_at is null),
      'oldest_age_seconds',
        (select coalesce(extract(epoch from now() - min(created_at))::int, 0)
           from tg_outbox where sent_at is null),
      -- dead-letter: attempts>=5 и не отправлено — processOutboxBatch их
      -- пропускает навсегда, это застрявшие сообщения.
      'dead_letter', (select count(*) from tg_outbox where sent_at is null and attempts >= 5)
    ),
    'verification_queue_depth',
      (select count(*) from verification_cases where state <> 'closed')
  );
$$;
