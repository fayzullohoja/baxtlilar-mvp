// Единый источник истины для текста согласия на обработку биометрических данных.
//
// 2026-07-10 (спец оунера): согласие на биометрию перенесено из бота в mini-app
// (экран верификации, ПЕРЕД загрузкой документа/селфи). И бот (legacy-путь для
// застрявших на bot_consent_biometric), и mini-app записывают согласие с ЭТИМ
// текстом → хэш (text + '::' + LEGAL_VERSION) consistent независимо от поверхности
// (совет advisor: избегаем «два текста — одна версия»).
//
// Формулировки — спец оунера: «документ, удостоверяющий личность» вместо
// «фото паспорта»; «уполномоченные специалисты и системы проверки» вместо
// «только модератор».
export const BIOMETRIC_CONSENT_TEXT: { ru: string; uz: string; tr: string } = {
  ru:
    "Отдельное согласие: обработка биометрических данных (документ, удостоверяющий личность, и селфи) " +
    "для проверки личности. Доступ имеют только уполномоченные специалисты и системы проверки " +
    "в рамках платформы; хранение — зашифровано; удаление — по запросу.",
  uz:
    "Alohida rozilik: shaxsni tasdiqlash uchun biometrik maʼlumotlarni qayta ishlash " +
    "(shaxsni tasdiqlovchi hujjat va selfi). Kirish faqat platforma doirasidagi vakolatli " +
    "mutaxassislar va tekshiruv tizimlariga ruxsat etilgan; saqlash — shifrlangan; " +
    "oʻchirish — soʻrov boʻyicha.",
  tr:
    "Ayrı rıza: kimlik doğrulaması için biyometrik verilerin (kimlik belgesi ve selfie) işlenmesi. Erişim yalnızca platform kapsamındaki yetkili uzmanlara ve doğrulama sistemlerine açıktır; saklama — şifrelidir; silme — talep üzerinedir.",
};
