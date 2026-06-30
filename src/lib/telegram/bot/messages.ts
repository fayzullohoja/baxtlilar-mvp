// Bilingual бот-копи. Hardcoded RU+UZ, без next-intl: бот живёт за пределами
// рендера, локали грузить незачем. Большинство сообщений двуязычные через "\n\n",
// чтобы не заставлять выбирать язык на самом первом сообщении.

const APP_URL = process.env.APP_URL ?? "https://baxtlilar-mvp-production.up.railway.app";

export const M = {
  greeting:
    "Salom! 👋\n" +
    "Baxtlilar — bu jiddiy va himoyalangan tanishuv ilovasi.\n\n" +
    "Привет! 👋\n" +
    "Baxtlilar — приложение для серьёзных, защищённых знакомств.\n\n" +
    "Tilni tanlang / Выберите язык:",
  lang_ru: "🇷🇺 Русский",
  lang_uz: "🇺🇿 Oʻzbekcha",

  contact_ask: {
    ru:
      "Чтобы зарегистрироваться, поделитесь номером телефона.\n" +
      "Нажмите кнопку ниже — Telegram отправит номер автоматически.\n\n" +
      "SMS мы НЕ шлём: номер уже подтверждён Telegram'ом.",
    uz:
      "Roʻyxatdan oʻtish uchun telefon raqamingni ulash.\n" +
      "Pastdagi tugmani bos — Telegram raqamni avtomatik yuboradi.\n\n" +
      "Biz SMS yubormaymiz: raqam allaqachon Telegram tomonidan tasdiqlangan.",
  },
  contact_button: { ru: "📱 Поделиться номером", uz: "📱 Raqamni ulashish" },
  contact_not_yours: {
    ru: "Это чужой номер. Поделитесь СВОИМ через кнопку.",
    uz: "Bu boshqa odamning raqami. Tugma orqali OʻZ raqamingni ulash.",
  },

  pd_consent_ask: {
    ru:
      "📜 <b>Документы Baxtlilar</b>\n\n" +
      "Перед согласием ознакомьтесь с условиями платформы:\n\n" +
      `1. <a href="${APP_URL}/legal/user-agreement.pdf">Пользовательское соглашение (оферта)</a>\n` +
      `2. <a href="${APP_URL}/legal/privacy.pdf">Политика конфиденциальности</a>\n` +
      `3. <a href="${APP_URL}/legal/rules.pdf">Правила платформы</a>\n` +
      `4. <a href="${APP_URL}/legal/pd-consent.pdf">Согласие на обработку персональных данных</a>\n\n` +
      "После согласия попросим Ваш номер телефона. Биометрию для верификации " +
      "запросим отдельно — это отдельное согласие на следующем шаге.",
    uz:
      "📜 <b>Baxtlilar hujjatlari</b>\n\n" +
      "Rozilik berishdan oldin platforma shartlari bilan tanishib chiqing:\n\n" +
      `1. <a href="${APP_URL}/legal/user-agreement.pdf">Foydalanuvchi shartnomasi (oferta)</a>\n` +
      `2. <a href="${APP_URL}/legal/privacy.pdf">Maxfiylik siyosati</a>\n` +
      `3. <a href="${APP_URL}/legal/rules.pdf">Platforma qoidalari</a>\n` +
      `4. <a href="${APP_URL}/legal/pd-consent.pdf">Shaxsiy maʼlumotlarni qayta ishlashga rozilik</a>\n\n` +
      "Rozilikdan keyin telefon raqamingizni soʻraymiz. Biometrik tasdiqlash " +
      "alohida soʻraladi — bu keyingi qadamda alohida rozilik.",
  },
  pd_consent_yes: { ru: "✅ Согласен", uz: "✅ Roziman" },
  pd_consent_no: { ru: "❌ Отказаться", uz: "❌ Rad etish" },

  bio_consent_ask: {
    ru:
      "Отдельное согласие: обработка биометрических данных (фото паспорта + селфи) " +
      "для проверки личности. Доступ — только модератор, хранение — зашифровано, " +
      "удаление — по запросу.",
    uz:
      "Alohida rozilik: shaxsni tasdiqlash uchun biometrik maʼlumotlarni qayta ishlash " +
      "(pasport surati + selfi). Faqat moderator koʻradi, shifrlangan saqlash, " +
      "soʻrov bilan oʻchirish.",
  },
  bio_consent_yes: { ru: "✅ Согласен на биометрию", uz: "✅ Biometriyaga roziman" },
  bio_consent_no: { ru: "❌ Отказаться", uz: "❌ Rad etish" },

  ready: {
    ru: "Готово! Откройте приложение и загрузите паспорт + селфи для верификации.",
    uz: "Tayyor! Ilovani och va pasport + selfi yuklab tasdiqlanishdan oʻt.",
  },
  open_app: { ru: "🚀 Открыть Baxtlilar", uz: "🚀 Baxtlilar'ni ochish" },

  already_active: {
    ru: "Вы уже в Baxtlilar. Откройте приложение:",
    uz: "Sen allaqachon Baxtlilar'dasan. Ilovani och:",
  },

  declined_pd: {
    ru: "Без согласия не можем зарегистрировать. Если передумаете — /start.",
    uz: "Rozilik boʻlmasa, roʻyxatdan oʻtkaza olmaymiz. Fikring oʻzgarsa — /start.",
  },
  declined_bio: {
    ru: "Без согласия на биометрию верификация невозможна. Если передумаете — /start.",
    uz: "Biometriya roziligi boʻlmasa, tasdiqlash mumkin emas. Fikring oʻzgarsa — /start.",
  },

  resume_at_step: {
    ru: "Продолжим. Текущий шаг — ниже.",
    uz: "Davom etamiz. Joriy qadam — quyida.",
  },

  error_generic: {
    ru: "Что-то пошло не так. Попробуйте /start ещё раз.",
    uz: "Nimadir notoʻgʻri ketdi. /start ni qaytadan urinib koʻr.",
  },

  // F-006: cooldown после удаления аккаунта. {until} подставляется ISO-датой
  // (день; точная локализация не нужна).
  phone_cooldown: {
    ru: "Этот номер недавно использовался для удалённого аккаунта. Регистрация повторно — после {until}. Если ошибка — напишите в поддержку.",
    uz: "Bu raqam yaqinda oʻchirilgan hisob uchun ishlatilgan. Qaytadan roʻyxatdan oʻtish {until} dan keyin. Xato boʻlsa — qoʻllab-quvvatlash xizmatiga yozing.",
  },

  // R2/C8/C11: blocking-tombstone от модератора. Не показываем until-дату
  // (10 лет), чтобы не выглядело как «подождать год». Прямо — в поддержку.
  phone_blocking: {
    ru: "Регистрация с этим номером недоступна. Если Вы считаете это ошибкой — напишите в поддержку.",
    uz: "Bu raqam bilan roʻyxatdan oʻtish mumkin emas. Agar bu xato deb hisoblasangiz — qoʻllab-quvvatlash xizmatiga yozing.",
  },
  phone_check_failed: {
    ru: "Не удалось проверить номер. Попробуйте чуть позже.",
    uz: "Raqamni tekshirib boʻlmadi. Bir oz keyinroq urinib koʻring.",
  },
  blocked_by_moderator: {
    ru: "Заблокирован модератором.",
    uz: "Moderator tomonidan bloklangan.",
  },
  phone_recognize_failed: {
    ru: "Не удалось распознать номер. Попробуйте ещё раз.",
    uz: "Raqam tushunilmadi. Qaytadan urinib koʻring.",
  },
  phone_duplicate: {
    ru: "Этот номер уже зарегистрирован в Baxtlilar.",
    uz: "Bu raqam Baxtlilar da allaqachon roʻyxatdan oʻtgan.",
  },
} as const;

export type Lang = "ru" | "uz";

export function pick<T extends { ru: string; uz: string }>(m: T, lang: Lang): string {
  return m[lang];
}
