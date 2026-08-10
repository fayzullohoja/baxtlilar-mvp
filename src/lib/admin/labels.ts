// RU-подписи enum'ов для админки (панель только на русском). Покрывают ВСЕ значения enum из схемы.

export const LIFECYCLE_RU: Record<string, string> = {
  onboarding: "Онбординг",
  active: "Активные",
  paused: "На паузе",
  blocked: "Заблокированы",
  deleted: "Удалены",
};

export const VERIFICATION_RU: Record<string, string> = {
  none: "Нет анкеты",
  not_started: "Не начата",
  phone_verified: "Телефон подтверждён",
  documents_uploaded: "Документы загружены",
  liveness_uploaded: "Селфи загружено",
  pending_review: "На проверке",
  needs_changes: "Нужны правки",
  approved: "Одобрены",
  rejected: "Отклонены",
  revoked: "Отозвана",
};

export const GENDER_RU: Record<string, string> = { m: "♂ М", f: "♀ Ж" };

export const lifecycleRu = (k: string): string => LIFECYCLE_RU[k] ?? k;
export const verificationRu = (k: string): string => VERIFICATION_RU[k] ?? k;
export const genderRu = (k: string | null | undefined): string => (k ? GENDER_RU[k] ?? k : "—");

/**
 * Человекочитаемые тексты кодов ошибок админских эндпоинтов.
 * Общий словарь: раньше своя копия жила в ClientsTable, а DangerZone показывал
 * сырой код («blocked_or_pending_ban») прямо оператору.
 */
export const ADMIN_ERROR_RU: Record<string, string> = {
  blocked_or_pending_ban:
    "Пользователь заблокирован или в ожидании бана — сброс недоступен. Используйте «Удалить» или сначала разбаньте.",
  reason_required: "Укажите причину (не короче 3 символов).",
  confirm_required: "Наберите слово подтверждения.",
  forbidden: "Недостаточно прав для этого действия.",
  not_found: "Запись не найдена (возможно, уже удалена).",
  not_flagged: "Флаг уже снят — одобрять нечего.",
  not_claimed_by_you: "Кейс закреплён за другим модератором.",
  case_closed: "Кейс уже закрыт.",
  stale_case: "Данные кейса устарели — обновите страницу и повторите.",
  self_deactivate: "Нельзя деактивировать самого себя.",
  self_demote: "Нельзя разжаловать самого себя.",
  last_superadmin: "Это последний активный суперадмин — действие запрещено.",
  login_taken: "Логин уже занят.",
  internal: "Внутренняя ошибка сервера. Попробуйте ещё раз.",
};
