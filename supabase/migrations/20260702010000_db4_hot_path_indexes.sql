-- DB-4 — Партиальные индексы для горячих путей (scale к 10k).
--
-- 1) Рекомендации/карточка тянут одобренные фото юзера (order by is_main, ord).
--    Без индекса — seq-scan profile_photos на каждый рендер /main и /profile.
-- 2) SSE-чат и chat-list считают непрочитанные на каждом тике (read_at is null).
--    Партиальный индекс покрывает именно этот предикат, не раздувая индекс всеми
--    прочитанными сообщениями.

create index if not exists profile_photos_user_approved_idx
  on profile_photos (user_id)
  where status = 'approved';

create index if not exists chat_messages_unread_idx
  on chat_messages (chat_id, sender_id)
  where read_at is null;
