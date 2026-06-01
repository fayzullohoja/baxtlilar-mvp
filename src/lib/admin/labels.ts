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
