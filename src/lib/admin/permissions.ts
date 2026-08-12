// RBAC (Волна 7, Фаза 1). Гранулярные права через ФИКСИРОВАННЫЕ роли +
// capability-map в КОДЕ (не runtime-editable arbitrary-движок — для ops-команды
// из основателя + пары модераторов это лишний authz-surface). `can()` —
// единственный примитив; default-deny (неизвестная роль/право → false).
//
// ⚠️ RLS выключен на всех таблицах → эти проверки И ЕСТЬ вся защита. Матрица
// role×capability зафиксирована тестом permissions.test.ts — build/tsc НЕ
// поймают случайное ослабление гейта, а матричный тест поймает.

export const PERMISSIONS = [
  "queue.work", // очередь верификаций: claim/draft/decision/release/note/blocking-reject + карточка кейса
  "queue.viewAll", // надзорный вид «все открытые кейсы» (не только свои)
  "photos.moderate", // модерация фото
  "reports.triage", // жалобы: просмотр + разбор
  "users.moderate", // не-деструктивная модерация юзера (approve-marital)
  "clients.directory", // просмотр PII-директории (поиск/список/карточка по ПИНФЛ/паспорту/телефону)
  "users.sanction", // деструктивные действия над аккаунтом (ban/unban/unblock/delete/restart)
  "analytics.view", // аналитика/воронка/демография
  "audit.viewAll", // видеть ВЕСЬ аудит (модератор видит только свои действия)
  "staff.manage", // управление аккаунтами админов (Фаза 2)
  "settings.edit", // системные настройки (Фаза 3)
  "profiles.edit", // правка полей анкеты юзера из карточки (кроме паспортных пол/ДР)
  "i18n.edit", // конструктор текстовок: правка строк локализации мини-аппа (глобальный blast-radius)
  // Раздел «Приглашения» (Task 10): список кодов, гашение чужого кода (=
  // закрытие персонального права приглашать - последствие для человека) и
  // выпуск мастер-кода (обходит весь invite-шлагбаум сразу для любого числа
  // людей). Оба рычага - консеквентные, по образцу users.sanction, поэтому
  // super-only (НЕ добавлено в MODERATOR_CAPS ниже).
  "invites.manage",
  // Раздел «Отзывы» (Task 8): свободный текст отзыва и скриншот к нему. Рычагов
  // над человеком тут нет, но материал - того же класса, что паспорт: человек
  // прикладывает переписку, на которой чужие имена, фото и обстоятельства (см.
  // BUCKET_FEEDBACK в src/lib/uploads/storage.ts - отдельный приватный бакет и
  // подписанная ссылка на 5 минут именно поэтому). Отсюда super-only, как и оба
  // соседних раздела реестра - clients.directory и invites.manage.
  //
  // Модератору тот же материал закрыт в упор: карточка клиента отдаёт notFound()
  // и пишет out_of_queue_user_view в admin_scope_violations, кейс с паспортом
  // ограничен своей очередью. Открыть ему отзывы значило бы обойти эту же
  // scope-модель кругом - без очереди, без 404 и без единой строки следа.
  "feedback.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type AdminRole = "superadmin" | "moderator";

// Права модератора. Superadmin получает ВСЕ (см. ROLE_CAPS). Единственное
// НАМЕРЕННОЕ расширение в Волне 7: reports.triage добавлен модератору (решение
// оунера «открыть жалобы модераторам»). Всё остальное — как было.
const MODERATOR_CAPS: readonly Permission[] = [
  "queue.work",
  "photos.moderate",
  "reports.triage",
  "users.moderate",
  "profiles.edit", // ревью оунера 2026-07-14: правка анкет открыта и модераторам (всё в аудите)
  "i18n.edit", // конструктор текстовок: оунер просил «под ролями супер админа и модератора»; всё в аудите
];

const ROLE_CAPS: Record<AdminRole, ReadonlySet<Permission>> = {
  superadmin: new Set<Permission>(PERMISSIONS),
  moderator: new Set<Permission>(MODERATOR_CAPS),
};

/** Единственный примитив авторизации. Default-deny. */
export function can(role: string | null | undefined, perm: Permission): boolean {
  if (role !== "superadmin" && role !== "moderator") return false;
  return ROLE_CAPS[role].has(perm);
}
