/**
 * Единый словарь «код ошибки сервера -> ключ подписи» для экранов загрузки
 * документов.
 *
 * Зачем он один на два экрана. Загрузку паспорта и селфи делают два разных
 * компонента - UploadField (первичная подача) и needs-changes-form (перезалив
 * после решения модератора), и каждый имел свою обработку. Обе были неполными
 * и по-разному:
 *
 *   - UploadField знал 6 кодов, а роуты и proxy отдают их вдвое больше;
 *     остальное падало в общее «Не удалось загрузить»;
 *   - needs-changes-form различала ровно один код: всё, что не too_large,
 *     подписывалось как «неподходящий тип файла». Человек с правильным JPEG,
 *     которому модератор вынес блокирующий отказ, видел совет «пришлите файл
 *     другого формата» и пересохранял снимок по кругу.
 *
 * Пока словарь один, добавление нового кода в роут видно обоим экранам сразу.
 *
 * ВАЖНО: ключи ошибок proxy.ts (payload_too_large, rate_limited, cross_origin)
 * тоже здесь - их отдаёт не роут, а слой выше, и до этого их не знал никто.
 */

/** Коды, которые может вернуть загрузка документа: роут, proxy или сеть. */
export const UPLOAD_ERROR_KEYS: Record<string, string> = {
  // размер и формат
  too_large: "tooLarge",
  payload_too_large: "tooLarge",
  bad_type: "badType",

  // ничего не выбрано
  no_file: "noFile",
  no_form: "noFile",

  // дубликаты и чёрный список
  duplicate_identity: "duplicateIdentity",
  duplicate_passport: "duplicatePassport",
  duplicate_selfie: "duplicateSelfie",
  document_blacklisted: "documentBlacklisted",

  // согласие и рубильник
  biometric_consent_required: "consentRequired",
  feature_disabled: "temporarilyOff",

  // решение модератора и состояние шага
  blocking_reject: "blockingReject",
  wrong_step: "wrongStep",

  // временные
  rate_limited: "rateLimited",
  cross_origin: "failed",
  save_failed: "saveFailed",
  db: "saveFailed",
};

/**
 * Ключ подписи по коду ошибки. Неизвестный код даёт "failed" - общий текст,
 * но он остаётся именно запасным вариантом, а не подписью для половины кодов.
 */
export function uploadErrorKey(code: string | undefined | null): string {
  if (!code) return "failed";
  return UPLOAD_ERROR_KEYS[code] ?? "failed";
}
