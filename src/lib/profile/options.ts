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
  { value: "higher", ru: "Высшее / Бакалавр", uz: "Oliy / Bakalavr" },
  { value: "master", ru: "Магистр", uz: "Magistr" },
  { value: "phd", ru: "PhD / учёная степень", uz: "PhD / ilmiy daraja" }, // V5 owner spec
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
  // Anketa V5 (owner spec 2026-07-07): расширение списка стран.
  { value: "US", ru: "США", uz: "AQSH" },
  { value: "KR", ru: "Южная Корея", uz: "Janubiy Koreya" },
  { value: "JP", ru: "Япония", uz: "Yaponiya" },
  { value: "SA", ru: "Саудовская Аравия", uz: "Saudiya Arabistoni" },
  { value: "AE", ru: "ОАЭ", uz: "BAA" },
  { value: "QA", ru: "Катар", uz: "Qatar" },
  { value: "ID", ru: "Индонезия", uz: "Indoneziya" },
  { value: "MY", ru: "Малайзия", uz: "Malayziya" },
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

/** Формат проживания после брака. Required для serious-marriage платформы.
 * V4: `separate_near` удалён — учредитель счёл вариант неуместным. */
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
  // Anketa V5 (owner spec 2026-07-07): +переходный вариант и «пока не ясно».
  {
    value: "temporary_then_separate",
    ru: "Временно с родителями, потом отдельно",
    uz: "Vaqtincha ota-ona bilan, keyin alohida",
  },
  {
    value: "open_to_discuss",
    ru: "По договорённости",
    uz: "Kelishuvga qarab",
  },
  {
    value: "unsure",
    ru: "Пока не ясно",
    uz: "Hali aniq emas",
  },
];

/** Готовность к браку по срокам (owner spec §12). Матчинг-сигнал совместимости темпа. */
export const MARRIAGE_READINESS: Opt[] = [
  { value: "within_3m", ru: "В течение 3 месяцев", uz: "3 oy ichida" },
  { value: "within_6m", ru: "В течение 6 месяцев", uz: "6 oy ichida" },
  { value: "within_1y", ru: "В течение года", uz: "1 yil ichida" },
  { value: "no_rush", ru: "Не спешу — сначала познакомиться", uz: "Shoshilmayman, avval tanishmoqchiman" },
  { value: "unsure", ru: "Пока не ясно", uz: "Hali aniq emas" },
];

/** Готовность к переезду (owner spec §13). ≠ geo_preference (где искать партнёра). */
export const RELOCATION_READINESS: Opt[] = [
  { value: "ready", ru: "Готов(а) переехать в другой город/страну", uz: "Boshqa shahar/mamlakatga koʻchishga tayyorman" },
  { value: "only_my_city", ru: "Только в своём городе", uz: "Faqat oʻz shahrimda yashayman" },
  { value: "by_agreement", ru: "По договорённости", uz: "Kelishuvga qarab" },
  { value: "unsure", ru: "Пока не ясно", uz: "Hali aniq emas" },
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

/** Экран 7 — Модель распределения ролей в семье. Ключевой для matching.
 * V5 (owner spec 2026-07-07): 3 варианта (муж/жена/равное), формулировки
 * смягчены; `situational` («зависит от ситуации») убран. */
export const FAMILY_ROLE_MODEL: Opt[] = [
  { value: "traditional", ru: "Семья с лидерством мужчины", uz: "Erkak yetakchiligidagi oila" },
  { value: "woman_leads", ru: "Семья с лидерством женщины", uz: "Ayol yetakchiligidagi oila" },
  { value: "equal_partnership", ru: "Равное партнёрство", uz: "Oʻzaro teng sheriklik" },
];

/** Экран 7 — Взгляд на работу жены после брака. */
export const WIFE_WORK_VIEW: Opt[] = [
  { value: "welcome", ru: "Приветствую — пусть работает", uz: "Mamnuniyat bilan — ishlasin" },
  { value: "ok_if_needed", ru: "Допустимо, если нужно", uz: "Kerak boʻlsa, mumkin" },
  { value: "prefer_not", ru: "Предпочитаю, чтобы не работал(а)", uz: "Ishlamasligini afzal koʻraman" },
  { value: "against", ru: "Категорически против", uz: "Qatʼiy qarshi" },
  { value: "discuss", ru: "Готов(а) обсуждать", uz: "Muhokama qilishga tayyorman" },
];

/** Экран 7 — Принятие решений (в extended.family.decision_model).
 * V4: `by_domain` удалён (учредитель счёл лишним 4-й вариант). */
export const FAMILY_DECISION_MODEL: Opt[] = [
  { value: "husband_main", ru: "Основное за мужем", uz: "Asosiy qaror erda" },
  { value: "wife_main", ru: "Основное за женой", uz: "Asosiy qaror xotinda" },
  { value: "joint", ru: "Совместно", uz: "Birgalikda" },
];

/** Экран 7 — Бытовые обязанности (в extended.family.household_responsibility_model).
 * V4: `flexible` («Гибко по ситуации») заменён на `mostly_partner` — лейбл
 * подставляется в зависимости от пола пользователя через gender-wording helper:
 *   М-юзер видит «В основном жена», Ж-юзер видит «В основном муж».
 * Базовый ru/uz здесь нейтральный (для админки/preview); в формах используется
 * `getGenderedOptionLabel(HOUSEHOLD_RESPONSIBILITY_MODEL, value, userGender)`. */
export const HOUSEHOLD_RESPONSIBILITY_MODEL: Opt[] = [
  { value: "traditional", ru: "Традиционно (жена — дом, муж — обеспечение)", uz: "Anʼanaviy (xotin uy ishlari, er taʼminlash)" },
  { value: "shared_50_50", ru: "Поровну 50/50", uz: "Tengma-teng 50/50" },
  { value: "by_skill", ru: "По навыкам", uz: "Koʻnikma boʻyicha" },
  { value: "mostly_partner", ru: "В основном партнёр", uz: "Asosan hamroh" },
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

// ============================================================================
// Anketa V4 (2026-06-30) — спека «Чат 2 — Анкета.md»
// ============================================================================

/** V4 шаг basic — статус-чекбокс «показывать ли район проживания в анкете». */
export const DISTRICT_VISIBLE_DEFAULT = false;

// ---------- Финансы (Чат-2 Экран 9) ----------

/** Стабильность источника дохода. */
export const INCOME_SOURCE_STABILITY: Opt[] = [
  { value: "stable", ru: "Есть стабильный доход", uz: "Barqaror daromadim bor" },
  { value: "unstable", ru: "Доход бывает непостоянным", uz: "Daromadim oʻzgaruvchan" },
  { value: "none", ru: "Сейчас нет дохода", uz: "Hozircha daromadim yoʻq" },
  { value: "na", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Управление финансами в семье (Чат-2 Экран 9 блок 3). */
export const FAMILY_FINANCE_MANAGEMENT: Opt[] = [
  { value: "joint", ru: "Совместное планирование", uz: "Birgalikda rejalashtirish" },
  { value: "mostly_man", ru: "В основном ответственность за мужчиной", uz: "Asosan masʼuliyat erkakda" },
  { value: "mostly_woman", ru: "В основном ответственность за женщиной", uz: "Asosan masʼuliyat ayolda" },
  { value: "situational", ru: "Зависит от ситуации", uz: "Vaziyatga qarab" },
  { value: "later", ru: "Предпочитаю обсудить позже", uz: "Keyinroq muhokama qilishni xohlayman" },
];

/** Финансовые приоритеты (multi-select до 3). */
export const FINANCIAL_PRIORITIES: Opt[] = [
  { value: "no_debt", ru: "Ответственное отношение к долгам и кредитам", uz: "Qarz va kreditlarga masʼuliyatli yondashuv" },
  { value: "savings", ru: "Накопления и финансовая подушка", uz: "Jamgʻarma va moliyaviy yostiq" },
  { value: "investments", ru: "Инвестиции и рост капитала", uz: "Investitsiyalar va kapital oʻsishi" },
  { value: "budget_planning", ru: "Планирование бюджета", uz: "Byudjetni rejalashtirish" },
  { value: "literacy", ru: "Финансовая грамотность", uz: "Moliyaviy savodxonlik" },
  { value: "generosity", ru: "Щедрость и благотворительность", uz: "Saxiylik va xayriya" },
  { value: "housing", ru: "Покупка жилья", uz: "Uy-joy sotib olish" },
  { value: "travel", ru: "Путешествия и впечатления", uz: "Sayohatlar va taassurotlar" },
  { value: "independence", ru: "Финансовая независимость", uz: "Moliyaviy mustaqillik" },
];

/** Примерный ежемесячный доход (UZS) — Optional. Hidden public. */
export const MONTHLY_INCOME_RANGE: Opt[] = [
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman" },
  { value: "below_5m", ru: "До 5 млн сум", uz: "5 mln soʻmgacha" },
  { value: "5_10m", ru: "5–10 млн сум", uz: "5–10 mln soʻm" },
  { value: "10_20m", ru: "10–20 млн сум", uz: "10–20 mln soʻm" },
  { value: "20_40m", ru: "20–40 млн сум", uz: "20–40 mln soʻm" },
  { value: "40m_plus", ru: "40 млн+ сум", uz: "40 mln+ soʻm" },
  { value: "foreign", ru: "Доход в другой валюте / за рубежом", uz: "Daromad boshqa valyutada / chet elda" },
];

/** Финансовые обязательства (гранулярно: контролируемые/значительные). Hidden public. */
export const FINANCIAL_OBLIGATIONS: Opt[] = [
  { value: "none", ru: "Нет существенных обязательств", uz: "Muhim majburiyatlarim yoʻq" },
  { value: "controlled", ru: "Есть обязательства, которые я контролирую", uz: "Nazoratimdagi majburiyatlarim bor" },
  { value: "significant", ru: "Есть значительные обязательства", uz: "Katta majburiyatlarim bor" },
  { value: "na", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Жильё (owner spec §9). Cold в extended.finance, hidden public (без стигмы «нет дома»). */
export const HOUSING_STATUS: Opt[] = [
  { value: "own", ru: "Своё жильё", uz: "Shaxsiy uy-joyim bor" },
  { value: "rent", ru: "Аренда", uz: "Ijarada yashayman" },
  { value: "with_parents", ru: "С родителями / родственниками", uz: "Ota-onam / qarindoshlarim bilan yashayman" },
  { value: "none", ru: "Пока нет своего жилья", uz: "Hozircha shaxsiy uy-joyim yoʻq" },
  { value: "na", ru: "Не хочу отвечать", uz: "Javob berishni xohlamayman" },
];

// ---------- Образ жизни и привычки (Чат-2 Экран 10) ----------

/** Ритм / образ жизни. */
export const LIFESTYLE_PACE: Opt[] = [
  { value: "active", ru: "Активный", uz: "Faol" },
  { value: "calm", ru: "Спокойный", uz: "Tinch" },
  { value: "balanced", ru: "Сбалансированный", uz: "Muvozanatli" },
  { value: "na", ru: "Затрудняюсь ответить", uz: "Javob berishga qiynalaman" },
];

/** Свободное время (multi-select до 3). */
export const FREE_TIME_ACTIVITIES: Opt[] = [
  { value: "sports", ru: "Спорт и тренировки", uz: "Sport va mashqlar" },
  { value: "reading", ru: "Чтение книг", uz: "Kitob oʻqish" },
  { value: "travel", ru: "Путешествия", uz: "Sayohatlar" },
  { value: "family_time", ru: "Время с семьёй", uz: "Oila bilan vaqt" },
  { value: "music", ru: "Музыка", uz: "Musiqa" },
  { value: "art", ru: "Творчество", uz: "Ijod" },
  { value: "volunteering", ru: "Волонтёрство и помощь людям", uz: "Koʻngillilik va yordam" },
  { value: "games", ru: "Игры и развлечения", uz: "Oʻyinlar va dam olish" },
  { value: "nature", ru: "Природа и прогулки", uz: "Tabiat va sayrlar" },
  { value: "learning", ru: "Обучение и развитие", uz: "Oʻrganish va rivojlanish" },
  { value: "spiritual", ru: "Духовные практики", uz: "Maʼnaviy amaliyot" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];

/** Режим дня. */
export const DAILY_ROUTINE: Opt[] = [
  { value: "early", ru: "Ранний подъём (до 22:30)", uz: "Erta turish (22:30 gacha)" },
  { value: "middle", ru: "Средний режим (22:30–00:00)", uz: "Oʻrtacha (22:30–00:00)" },
  { value: "late", ru: "Поздний (после 00:00)", uz: "Kech (00:00 dan keyin)" },
  { value: "unstable", ru: "Нестабильный режим", uz: "Beqaror" },
];

/** Вредные привычки. Hidden public. */
export const BAD_HABITS_LEVEL: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "sometimes", ru: "Иногда", uz: "Baʼzan" },
  { value: "quit", ru: "Бывало, но отказался(ась)", uz: "Boʻlgan, lekin tashladim" },
  { value: "yes", ru: "Есть", uz: "Bor" },
];

/** Питание. */
export const NUTRITION_STYLE: Opt[] = [
  { value: "balanced", ru: "Сбалансированно", uz: "Muvozanatli" },
  { value: "regular", ru: "Обычное питание", uz: "Oddiy ovqatlanish" },
  { value: "national", ru: "Предпочитаю национальную кухню", uz: "Milliy taomlarni yoqtiraman" },
  { value: "restricted", ru: "Есть ограничения", uz: "Cheklovlar bor" },
];

/** Отношение к алкоголю. Hidden public. */
export const ALCOHOL_LEVEL: Opt[] = [
  { value: "no", ru: "Не употребляю", uz: "Iste'mol qilmayman" },
  { value: "rare", ru: "Редко, по особым случаям", uz: "Kamdan-kam, alohida holatlarda" },
  { value: "sometimes", ru: "Иногда", uz: "Baʼzan" },
  { value: "regular", ru: "Регулярно", uz: "Muntazam" },
];

/** Наркотические вещества. Hidden public. Чувствительно. */
export const DRUGS_USE: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "past", ru: "Было в прошлом, сейчас нет", uz: "Oʻtmishda boʻlgan, hozir yoʻq" },
  { value: "na", ru: "Предпочитаю не отвечать", uz: "Javob bermaslikni afzal koʻraman" },
];

// ---------- Кого ищу: страны партнёра (Чат-2: «не делать жёстким фильтром») ----------

/** Multi-select из существующих CITIZENSHIP. Soft filter, max 3. */
export const PARTNER_PREFERRED_COUNTRIES: Opt[] = CITIZENSHIP;

// ---------- Районы УЗ (cascading per region) ----------
// Реэкспорт из src/lib/profile/uz-districts.ts, где живут ~98 записей
// по 6 крупнейшим регионам (Phase 1). Остальные регионы — freeform fallback.
export { UZ_DISTRICTS_BY_REGION, hasDistrictList } from "./uz-districts";

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);
export const labelOf = (o: Opt[], value: string, locale: string): string =>
  o.find((x) => x.value === value)?.[locale === "uz" ? "uz" : "ru"] ?? value;
