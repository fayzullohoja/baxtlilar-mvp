-- Live-чат: эфемерный индикатор «печатает…». Храним «печатает до <ts>» на стороне каждого участника.
-- Истечение — ленивое (peer typing = typing_x_until > now()); cron не нужен.
alter table chats
  add column if not exists typing_a_until timestamptz,
  add column if not exists typing_b_until timestamptz;
