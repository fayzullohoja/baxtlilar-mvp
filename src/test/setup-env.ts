// Глобальные ENV для vitest — выставляются ДО import любого src/**, чтобы
// env.ts (zod-parse) прошёл при первом обращении. Подключается через
// vitest.config.ts setupFiles. Тесты могут оверрайдить отдельные ключи.

process.env.SESSION_SECRET ??=
  "test-session-secret-must-be-at-least-32-chars-long";
process.env.TELEGRAM_BOT_TOKEN ??= "test-bot-token-1234567890";
process.env.TELEGRAM_WEBHOOK_SECRET ??= "test-webhook-secret-min-16-chars";
process.env.DATABASE_URL ??= "postgres://test";
