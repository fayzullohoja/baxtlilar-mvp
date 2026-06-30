// Списки опций лайт-анкеты (значение + ru/uz лейблы). Заземлено на Чат 2.
export type Opt = { value: string; ru: string; uz: string };

export const GENDER: Opt[] = [
  { value: "f", ru: "Женщина", uz: "Ayol" },
  { value: "m", ru: "Мужчина", uz: "Erkak" },
];

export const MARITAL_STATUS: Opt[] = [
  { value: "never", ru: "Никогда не был(а) в браке", uz: "Hech qachon turmush qurmagan" },
  { value: "divorced", ru: "В разводе", uz: "Ajrashgan" },
  { value: "widowed", ru: "Вдовец / вдова", uz: "Beva" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];

export const HAS_CHILDREN: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "yes", ru: "Да", uz: "Ha" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
];

export const CHILDREN_PLAN: Opt[] = [
  { value: "want", ru: "Хочу детей в будущем", uz: "Kelajakda farzand xohlayman" },
  { value: "have_maybe_more", ru: "Есть дети, возможно ещё", uz: "Farzandlarim bor, yana boʻlishi mumkin" },
  { value: "have_no_more", ru: "Есть дети, больше не планирую", uz: "Farzandlarim bor, koʻproq rejalashtirmayman" },
  { value: "unsure", ru: "Пока не знаю", uz: "Hozircha bilmayman" },
  { value: "open", ru: "Готов(а) обсудить", uz: "Muhokama qilishga tayyorman" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
];

export const RELIGION: Opt[] = [
  { value: "islam", ru: "Ислам", uz: "Islom" },
  { value: "christianity", ru: "Христианство", uz: "Xristianlik" },
  { value: "judaism", ru: "Иудаизм", uz: "Yahudiylik" },
  { value: "buddhism", ru: "Буддизм", uz: "Buddizm" },
  { value: "other", ru: "Другая религия", uz: "Boshqa din" },
  { value: "none", ru: "Не исповедую религию", uz: "Dinga eʼtiqod qilmayman" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
];

export const LIFE_VALUES: Opt[] = [
  { value: "family", ru: "Семья и отношения", uz: "Oila va munosabatlar" },
  { value: "faith", ru: "Духовность и вера", uz: "Maʼnaviyat va eʼtiqod" },
  { value: "honesty", ru: "Честность и порядочность", uz: "Halollik va poklik" },
  { value: "growth", ru: "Развитие и обучение", uz: "Rivojlanish va oʻrganish" },
  { value: "health", ru: "Здоровье", uz: "Sogʻliq" },
  { value: "career", ru: "Карьера и самореализация", uz: "Karyera va oʻzini namoyon qilish" },
  { value: "finance", ru: "Финансовая стабильность", uz: "Moliyaviy barqarorlik" },
  { value: "helping", ru: "Помощь другим", uz: "Boshqalarga yordam" },
  { value: "freedom", ru: "Свобода и самостоятельность", uz: "Erkinlik va mustaqillik" },
];

export const EDUCATION: Opt[] = [
  { value: "secondary", ru: "Среднее", uz: "Oʻrta" },
  { value: "vocational", ru: "Среднее специальное", uz: "Oʻrta maxsus" },
  { value: "higher", ru: "Высшее", uz: "Oliy" },
  { value: "master", ru: "Магистр", uz: "Magistr" },
  { value: "studying", ru: "Учусь сейчас", uz: "Hozir oʻqiyapman" },
  { value: "courses", ru: "Проф. курсы", uz: "Kasbiy kurslar" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
];

export const EMPLOYMENT: Opt[] = [
  { value: "full", ru: "Полная занятость", uz: "Toʻliq bandlik" },
  { value: "part", ru: "Частичная занятость", uz: "Qisman bandlik" },
  { value: "business", ru: "Свой бизнес", uz: "Oʻz biznesi" },
  { value: "freelance", ru: "Свободный график", uz: "Erkin jadval" },
  { value: "studying", ru: "Учусь", uz: "Oʻqiyapman" },
  { value: "home_family", ru: "Дом и семья", uz: "Uy va oila" },
  { value: "unemployed", ru: "Временно не работаю", uz: "Vaqtincha ishlamayapman" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
];

export const GEO_PREFERENCE: Opt[] = [
  { value: "my_city", ru: "В моём городе", uz: "Mening shahrimda" },
  { value: "country", ru: "По всей стране", uz: "Butun mamlakat boʻylab" },
];

// ============================================================================
// Onboarding V2 Extension (2026-06-28) — продуктовые поправки
// ============================================================================

/** Гражданство. Список СНГ + Турция + другое. */
export const CITIZENSHIP: Opt[] = [
  { value: "UZ", ru: "Узбекистан", uz: "Oʻzbekiston" },
  { value: "RU", ru: "Россия", uz: "Rossiya" },
  { value: "KZ", ru: "Казахстан", uz: "Qozogʻiston" },
  { value: "KG", ru: "Киргизия", uz: "Qirgʻiziston" },
  { value: "TJ", ru: "Таджикистан", uz: "Tojikiston" },
  { value: "TM", ru: "Туркменистан", uz: "Turkmaniston" },
  { value: "TR", ru: "Турция", uz: "Turkiya" },
  { value: "OTHER", ru: "Другое", uz: "Boshqa" },
];

/** Страна фактического проживания. Те же опции что у CITIZENSHIP. */
export const COUNTRY_OF_RESIDENCE: Opt[] = CITIZENSHIP;

/** Регионы Узбекистана (для country_of_residence='UZ'). 12 областей + 2 особых. */
export const UZ_REGIONS: Opt[] = [
  { value: "tashkent_city", ru: "г. Ташкент", uz: "Toshkent sh." },
  { value: "tashkent_region", ru: "Ташкентская область", uz: "Toshkent vil." },
  { value: "andijan", ru: "Андижанская область", uz: "Andijon vil." },
  { value: "bukhara", ru: "Бухарская область", uz: "Buxoro vil." },
  { value: "fergana", ru: "Ферганская область", uz: "Fargʻona vil." },
  { value: "jizzakh", ru: "Джизакская область", uz: "Jizzax vil." },
  { value: "kashkadarya", ru: "Кашкадарьинская область", uz: "Qashqadaryo vil." },
  { value: "khorezm", ru: "Хорезмская область", uz: "Xorazm vil." },
  { value: "namangan", ru: "Наманганская область", uz: "Namangan vil." },
  { value: "navoiy", ru: "Навоийская область", uz: "Navoiy vil." },
  { value: "samarkand", ru: "Самаркандская область", uz: "Samarqand vil." },
  { value: "sirdaryo", ru: "Сырдарьинская область", uz: "Sirdaryo vil." },
  { value: "surkhandarya", ru: "Сурхандарьинская область", uz: "Surxondaryo vil." },
  { value: "karakalpakstan", ru: "Каракалпакстан", uz: "Qoraqalpogʻiston" },
];

/** Языки. Используется и для native_language (single), и для languages[] (multi). */
export const LANGUAGES_LIST: Opt[] = [
  { value: "uz", ru: "Узбекский", uz: "Oʻzbek" },
  { value: "ru", ru: "Русский", uz: "Rus" },
  { value: "kaa", ru: "Каракалпакский", uz: "Qoraqalpoq" },
  { value: "kk", ru: "Казахский", uz: "Qozoq" },
  { value: "ky", ru: "Киргизский", uz: "Qirgʻiz" },
  { value: "tg", ru: "Таджикский", uz: "Tojik" },
  { value: "tk", ru: "Туркменский", uz: "Turkman" },
  { value: "tr", ru: "Турецкий", uz: "Turk" },
  { value: "en", ru: "Английский", uz: "Ingliz" },
  { value: "ar", ru: "Арабский", uz: "Arab" },
  { value: "other", ru: "Другой", uz: "Boshqa" },
];

/** Религиозная практика — заменяет шкалу 1-5. */
export const RELIGION_PRACTICE: Opt[] = [
  {
    value: "observant",
    ru: "Соблюдаю все каноны — основа моей жизни",
    uz: "Barcha qonun-qoidalarga rioya qilaman — hayotimning asosi",
  },
  {
    value: "striving",
    ru: "Верю и стремлюсь соблюдать; иногда не получается",
    uz: "Ishonaman va rioya qilishga harakat qilaman; baʼzan boʻlmaydi",
  },
  {
    value: "cultural",
    ru: "Культурная принадлежность; традиции уважаю",
    uz: "Madaniy mansublik; anʼanalarni hurmat qilaman",
  },
  {
    value: "not_practicing",
    ru: "Не практикую активно",
    uz: "Faol amal qilmayman",
  },
];

/** Желание совпадения религии у партнёра. Optional поле. */
export const RELIGION_PARTNER_MATCH: Opt[] = [
  {
    value: "same_religion_same_practice",
    ru: "Только моя религия + тот же уровень практики",
    uz: "Faqat mening dinim + xuddi shu daraja amal",
  },
  {
    value: "same_religion",
    ru: "Желательно моя религия",
    uz: "Mening dinimda boʻlsa yaxshi",
  },
  {
    value: "mutual_respect",
    ru: "Главное — взаимоуважение",
    uz: "Asosiysi — oʻzaro hurmat",
  },
];

/** Формат проживания после брака. Required для serious-marriage платформы. */
export const POST_MARRIAGE_LIVING: Opt[] = [
  {
    value: "with_husband_family",
    ru: "С семьёй мужа",
    uz: "Erning oilasi bilan",
  },
  {
    value: "with_wife_family",
    ru: "С семьёй жены",
    uz: "Xotinning oilasi bilan",
  },
  {
    value: "separate",
    ru: "Отдельно от родителей",
    uz: "Ota-onadan alohida",
  },
  {
    value: "separate_near",
    ru: "Отдельно, но рядом с родителями",
    uz: "Alohida, lekin ota-onaga yaqin",
  },
  {
    value: "open_to_discuss",
    ru: "Готов(а) обсуждать",
    uz: "Muhokama qilishga tayyorman",
  },
];

// ============================================================================
// Anketa V3 MVP (2026-06-29) — Sprint 1 enum-наборы для новых экранов
// ============================================================================

/** Экран 3 — Деятельность. 17 опций. */
export const ACTIVITY_FIELDS: Opt[] = [
  { value: "it_software", ru: "IT / Разработка", uz: "IT / Dasturlash" },
  { value: "finance_banking", ru: "Финансы / Банки", uz: "Moliya / Banklar" },
  { value: "education_science", ru: "Образование / Наука", uz: "Taʼlim / Fan" },
  { value: "medicine_health", ru: "Медицина / Здоровье", uz: "Tibbiyot / Sogʻliq" },
  { value: "state_service", ru: "Госслужба", uz: "Davlat xizmati" },
  { value: "law_legal", ru: "Юриспруденция", uz: "Yuristlik" },
  { value: "business_entrepreneurship", ru: "Бизнес / Предпринимательство", uz: "Biznes / Tadbirkorlik" },
  { value: "agriculture", ru: "Сельское хозяйство", uz: "Qishloq xoʻjaligi" },
  { value: "construction_realestate", ru: "Строительство / Недвижимость", uz: "Qurilish / Koʻchmas mulk" },
  { value: "manufacturing_industry", ru: "Производство / Промышленность", uz: "Ishlab chiqarish" },
  { value: "trade_retail", ru: "Торговля / Розница", uz: "Savdo / Chakana" },
  { value: "transport_logistics", ru: "Транспорт / Логистика", uz: "Transport / Logistika" },
  { value: "media_creative", ru: "Медиа / Творчество", uz: "Media / Ijod" },
  { value: "services", ru: "Услуги / Сервис", uz: "Xizmatlar" },
  { value: "religion_spiritual", ru: "Религия / Духовная сфера", uz: "Din / Maʼnaviyat" },
  { value: "household_homemaker", ru: "Дом и семья", uz: "Uy va oila" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];

/** Экран 3 — Формат занятости. */
export const EMPLOYMENT_FORMAT: Opt[] = [
  { value: "office", ru: "Офис", uz: "Ofis" },
  { value: "remote", ru: "Удалённо", uz: "Masofadan" },
  { value: "hybrid", ru: "Гибрид", uz: "Gibrid" },
  { value: "own_business", ru: "Свой бизнес", uz: "Oʻz biznesi" },
  { value: "not_working", ru: "Не работаю сейчас", uz: "Hozir ishlamayman" },
];

/** Экран 5 — План по детям в будущем. Заменяет deprecated CHILDREN_PLAN. */
export const FUTURE_CHILDREN_PLAN: Opt[] = [
  { value: "yes_soon", ru: "Да, в ближайшее время", uz: "Ha, yaqin orada" },
  { value: "yes_later", ru: "Да, в будущем", uz: "Ha, kelajakda" },
  { value: "maybe", ru: "Возможно", uz: "Balki" },
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "with_partner_decide", ru: "Решим вместе с партнёром", uz: "Hamroh bilan birga qaror qilamiz" },
];

/** Экран 6 — Топ-ценности (1-3 выбора из 14). */
export const LIFE_VALUES_V3: Opt[] = [
  { value: "family", ru: "Семья", uz: "Oila" },
  { value: "faith", ru: "Вера", uz: "Eʼtiqod" },
  { value: "honesty", ru: "Честность", uz: "Halollik" },
  { value: "respect", ru: "Уважение", uz: "Hurmat" },
  { value: "kindness", ru: "Доброта", uz: "Mehribonlik" },
  { value: "responsibility", ru: "Ответственность", uz: "Masʼuliyat" },
  { value: "tradition", ru: "Традиции", uz: "Anʼanalar" },
  { value: "education", ru: "Образование", uz: "Taʼlim" },
  { value: "health", ru: "Здоровье", uz: "Sogʻliq" },
  { value: "career", ru: "Карьера", uz: "Karyera" },
  { value: "financial_stability", ru: "Финансовая стабильность", uz: "Moliyaviy barqarorlik" },
  { value: "community", ru: "Община / Махалла", uz: "Hamjamiyat / Mahalla" },
  { value: "self_development", ru: "Саморазвитие", uz: "Oʻzini rivojlantirish" },
  { value: "independence", ru: "Самостоятельность", uz: "Mustaqillik" },
];

/** Экран 7 — Модель распределения ролей в семье. Ключевой для matching. */
export const FAMILY_ROLE_MODEL: Opt[] = [
  { value: "traditional", ru: "Традиционная (мужчина — глава семьи)", uz: "Anʼanaviy (erkak — oila boshligʻi)" },
  { value: "equal_partnership", ru: "Равное партнёрство", uz: "Teng hamkorlik" },
  { value: "woman_leads", ru: "Женщина-лидер", uz: "Ayol yetakchi" },
  { value: "situational", ru: "Зависит от ситуации", uz: "Vaziyatga qarab" },
];

/** Экран 7 — Взгляд на работу жены после брака. */
export const WIFE_WORK_VIEW: Opt[] = [
  { value: "welcome", ru: "Приветствую — пусть работает", uz: "Mamnuniyat bilan — ishlasin" },
  { value: "ok_if_needed", ru: "Допустимо, если нужно", uz: "Kerak boʻlsa, mumkin" },
  { value: "prefer_not", ru: "Предпочитаю, чтобы не работала", uz: "Ishlamasligini afzal koʻraman" },
  { value: "against", ru: "Категорически против", uz: "Qatʼiy qarshi" },
  { value: "discuss", ru: "Готов(а) обсуждать", uz: "Muhokama qilishga tayyorman" },
];

/** Экран 7 — Принятие решений (в extended.family.decision_model). */
export const FAMILY_DECISION_MODEL: Opt[] = [
  { value: "husband_main", ru: "Основное за мужем", uz: "Asosiy qaror erda" },
  { value: "wife_main", ru: "Основное за женой", uz: "Asosiy qaror xotinda" },
  { value: "joint", ru: "Совместно", uz: "Birgalikda" },
  { value: "by_domain", ru: "По сферам", uz: "Sohalar boʻyicha" },
];

/** Экран 7 — Бытовые обязанности (в extended.family.household_responsibility_model). */
export const HOUSEHOLD_RESPONSIBILITY_MODEL: Opt[] = [
  { value: "traditional", ru: "Традиционно (жена — дом, муж — обеспечение)", uz: "Anʼanaviy (xotin uy ishlari, er taʼminlash)" },
  { value: "shared_50_50", ru: "Поровну 50/50", uz: "Tengma-teng 50/50" },
  { value: "by_skill", ru: "По навыкам", uz: "Koʻnikma boʻyicha" },
  { value: "flexible", ru: "Гибко по ситуации", uz: "Vaziyatga qarab" },
];

/** Экран 12 — Важность жить отдельно от родителей (в extended.living). */
export const SEPARATE_FROM_PARENTS_IMPORTANCE: Opt[] = [
  { value: "must", ru: "Обязательно отдельно", uz: "Albatta alohida" },
  { value: "preferred", ru: "Желательно отдельно", uz: "Alohida boʻlgani yaxshi" },
  { value: "neutral", ru: "Нейтрально", uz: "Farqi yoʻq" },
  { value: "not_important", ru: "Не принципиально", uz: "Muhim emas" },
];

/** Экран 8 — Топ-качества партнёра (1-5 выбора из 14). */
export const PARTNER_QUALITIES: Opt[] = [
  { value: "kindness", ru: "Доброта", uz: "Mehribonlik" },
  { value: "honesty", ru: "Честность", uz: "Halollik" },
  { value: "responsibility", ru: "Ответственность", uz: "Masʼuliyat" },
  { value: "intelligence", ru: "Интеллект", uz: "Aql-zakovat" },
  { value: "sense_of_humor", ru: "Чувство юмора", uz: "Hazil tuygʻusi" },
  { value: "religiosity", ru: "Религиозность", uz: "Diniylik" },
  { value: "ambition", ru: "Амбициозность", uz: "Maqsadli" },
  { value: "calmness", ru: "Спокойствие", uz: "Bosiqlik" },
  { value: "loyalty", ru: "Верность", uz: "Sadoqat" },
  { value: "family_oriented", ru: "Семейные ценности", uz: "Oilaga sadoqat" },
  { value: "caring", ru: "Заботливость", uz: "Gʻamxoʻrlik" },
  { value: "independence", ru: "Самостоятельность", uz: "Mustaqillik" },
  { value: "generosity", ru: "Щедрость", uz: "Saxiylik" },
  { value: "patience", ru: "Терпение", uz: "Sabr" },
];

/** Экран 16 — Глобальный режим видимости профиля. Per-block visibility — НЕ в MVP. */
export const PROFILE_VISIBILITY_MODE: Opt[] = [
  { value: "public", ru: "Открытый профиль", uz: "Ochiq profil" },
  { value: "verified_only", ru: "Только для верифицированных", uz: "Faqat tasdiqlanganlarga" },
  { value: "by_request", ru: "По запросу", uz: "Soʻrov boʻyicha" },
];

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);
export const labelOf = (o: Opt[], value: string, locale: string): string =>
  o.find((x) => x.value === value)?.[locale === "uz" ? "uz" : "ru"] ?? value;
