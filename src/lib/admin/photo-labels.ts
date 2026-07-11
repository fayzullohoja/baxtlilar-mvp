// Лейблы типов/статусов фото для админ-модерации (PH-2). RU-first ops-tool.
// family — чувствительное (только post-mutual), выделяем отдельно.

export const PHOTO_TYPE_RU: Record<string, string> = {
  portrait: "Портрет",
  full_body: "В полный рост",
  family: "Семейное",
};

export const PHOTO_STATUS_RU: Record<string, string> = {
  uploaded: "Загружено",
  under_review: "На проверке",
  approved: "Одобрено",
  needs_replacement: "Нужна замена",
  rejected: "Отклонено",
  hidden_by_user: "Скрыто юзером",
};

export function photoTypeLabel(t: string | null | undefined): string {
  return PHOTO_TYPE_RU[t ?? "portrait"] ?? t ?? "—";
}

export function photoStatusLabel(s: string | null | undefined): string {
  return PHOTO_STATUS_RU[s ?? ""] ?? s ?? "—";
}
