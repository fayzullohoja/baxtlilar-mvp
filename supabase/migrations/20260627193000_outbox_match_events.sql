-- F1: матч/чат-события теперь идут через tg_outbox (retry-safe очередь +
-- рендер на локали получателя), а не через fire-and-forget notifyUser, который
-- молча терял уведомление при бане бота / временной ошибке Telegram API.
--
-- Расширяем CHECK на event_type четырьмя новыми типами. Старые строки и
-- enqueue_tg_outbox() не меняются. Идемпотентно (drop if exists → add).

alter table tg_outbox drop constraint if exists tg_outbox_event_type_check;

alter table tg_outbox
  add constraint tg_outbox_event_type_check check (event_type in (
    'verification_approved',
    'verification_needs_changes',
    'verification_rejected',
    'tutorial_reminder',
    'mutual_match',
    'new_interest',
    'interest_accepted',
    'new_message'
  ));
