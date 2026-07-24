-- C-094: transition_user граф переходов. Каждый ЛЕГИТИМНЫЙ переход проходит,
-- каждый ЗАПРЕЩЁННЫЙ отклоняется, ban-роутинг сохранён, а патчи только с
-- onboarding_step (анкета) НЕ ломаются.
begin;
set local search_path = public;

create temp sequence _tg_tid;

-- insert свежего юзера в (life, ver) и один вызов transition_user → jsonb.
create or replace function _tg_try(p_life lifecycle_state, p_ver verification_status, p_patch jsonb)
returns jsonb language plpgsql as $$
declare uid uuid; ts timestamptz;
begin
  insert into users(id, telegram_id, lifecycle_state, onboarding_step, verification_status)
  values (gen_random_uuid(), nextval('_tg_tid'), p_life, 'active', p_ver)
  returning id, updated_at into uid, ts;
  return transition_user(uid, p_patch, ts, 'test', 'admin', null);
end$$;

do $$
declare r jsonb;
begin
  -- ── lifecycle: ЛЕГИТИМНЫЕ (должны пройти) ──────────────────────────────
  assert (_tg_try('onboarding','not_started', '{"lifecycle_state":"active"}')->>'ok') = 'true',
    'onboarding→active должен пройти';
  assert (_tg_try('active','not_started', '{"lifecycle_state":"paused"}')->>'ok') = 'true',
    'active→paused должен пройти';
  assert (_tg_try('paused','not_started', '{"lifecycle_state":"active"}')->>'ok') = 'true',
    'paused→active должен пройти';
  -- РЕГРЕССИЯ: разбан идёт через transition_user — не сломать!
  assert (_tg_try('blocked','not_started', '{"lifecycle_state":"active"}')->>'ok') = 'true',
    'blocked→active (разбан) должен пройти';
  assert (_tg_try('blocked','not_started', '{"lifecycle_state":"onboarding"}')->>'ok') = 'true',
    'blocked→onboarding (разбан) должен пройти';
  assert (_tg_try('blocked','not_started', '{"lifecycle_state":"paused"}')->>'ok') = 'true',
    'blocked→paused (разбан) должен пройти';

  -- ── lifecycle: ЗАПРЕЩЁННЫЕ (эскалация/нелегитимные) ────────────────────
  r := _tg_try('active','not_started', '{"lifecycle_state":"onboarding"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_lifecycle_transition',
    'active→onboarding должен быть отклонён: ' || r::text;
  r := _tg_try('deleted','not_started', '{"lifecycle_state":"active"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_lifecycle_transition',
    'deleted→active (воскрешение) должен быть отклонён: ' || r::text;
  r := _tg_try('onboarding','not_started', '{"lifecycle_state":"paused"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_lifecycle_transition',
    'onboarding→paused должен быть отклонён: ' || r::text;

  -- ── ban-роутинг сохранён (существующий guard) ─────────────────────────
  r := _tg_try('active','not_started', '{"lifecycle_state":"blocked"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'ban_via_dedicated_rpc',
    '→blocked должен идти через admin_ban_*: ' || r::text;
  r := _tg_try('active','not_started', '{"lifecycle_state":"pending_ban"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'ban_via_dedicated_rpc',
    '→pending_ban должен идти через admin_ban_*: ' || r::text;

  -- ── ЗАЩИТА ОТ ПОБЕГА ИЗ pending_ban ───────────────────────────────────
  -- pending_ban НЕ может сам себя очистить в active/paused через transition_user:
  -- предложение бана (two-admin) резолвится ТОЛЬКО admin_ban_* RPC
  -- (confirm→blocked / cancel/expire→restore). Иначе юзер сбегал бы от бана,
  -- доиграв онбординг, и стёр бы pending-предложение. Роуты tutorial/welcome
  -- тоже гейтят на lifecycle=onboarding — это второй эшелон. НЕ добавлять
  -- pending_ban→* в вайтлист «чтобы починить застревание» — это вернёт побег.
  r := _tg_try('pending_ban','not_started', '{"lifecycle_state":"active"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_lifecycle_transition',
    'pending_ban→active (побег от бана) должен быть отклонён: ' || r::text;
  r := _tg_try('pending_ban','not_started', '{"lifecycle_state":"paused"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_lifecycle_transition',
    'pending_ban→paused (побег от бана) должен быть отклонён: ' || r::text;

  -- ── verification: ЛЕГИТИМНЫЕ ───────────────────────────────────────────
  assert (_tg_try('onboarding','not_started', '{"verification_status":"phone_verified"}')->>'ok') = 'true',
    'not_started→phone_verified должен пройти';
  assert (_tg_try('onboarding','phone_verified', '{"verification_status":"documents_uploaded"}')->>'ok') = 'true',
    'phone_verified→documents_uploaded должен пройти';
  assert (_tg_try('onboarding','documents_uploaded', '{"verification_status":"pending_review"}')->>'ok') = 'true',
    'documents_uploaded→pending_review должен пройти';
  assert (_tg_try('onboarding','needs_changes', '{"verification_status":"pending_review"}')->>'ok') = 'true',
    'needs_changes→pending_review (re-submit) должен пройти';
  assert (_tg_try('onboarding','rejected', '{"verification_status":"phone_verified"}')->>'ok') = 'true',
    'rejected→phone_verified (retry) должен пройти';

  -- ── verification: ЗАПРЕЩЁННЫЕ (решение модерации — только через admin_*) ─
  r := _tg_try('onboarding','rejected', '{"verification_status":"approved"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_verification_transition',
    'rejected→approved (обход модерации) должен быть отклонён: ' || r::text;
  r := _tg_try('onboarding','pending_review', '{"verification_status":"approved"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_verification_transition',
    'pending_review→approved (решение только через admin_approve) должен быть отклонён: ' || r::text;
  r := _tg_try('active','approved', '{"verification_status":"rejected"}');
  assert (r->>'ok') = 'false' and r->>'error' = 'illegal_verification_transition',
    'approved→rejected должен быть отклонён: ' || r::text;

  -- ── РЕГРЕССИЯ-ЛОВУШКА: патч только с onboarding_step НЕ трогает guard ──
  assert (_tg_try('active','approved', '{"onboarding_step":"profile_basic"}')->>'ok') = 'true',
    'патч только onboarding_step не должен падать на графе статусов';
  -- self-set (from==to) — no-op, проходит
  assert (_tg_try('active','approved', '{"lifecycle_state":"active"}')->>'ok') = 'true',
    'lifecycle self-set (active→active) должен пройти';

  raise notice '✓ tg1 transition_user graph guard: all asserts pass';
end$$;

drop function _tg_try(lifecycle_state, verification_status, jsonb);
rollback;
