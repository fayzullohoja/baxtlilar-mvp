// Списки опций лайт-анкеты (значение + ru/uz лейблы). Заземлено на Чат 2.
//
// `group` проставляется автоматически внизу файла (см. OPTION_GROUPS) и служит
// ключом редактируемого лейбла в i18n: `Options.<GROUP>.<value>` (конструктор
// текстовок Tier 2). ru/uz здесь остаются БАЗОЙ (fallback) — не удалять: если
// ключа в messages нет (новая опция / сбой генерации), рендер откатится сюда,
// а не покажет юзеру сырой ключ.
//
// ⚠ `value` — это enum-ключи zod + DB CHECK. Лейблы менять можно, values НЕТ.
export type Opt = { value: string; ru: string; uz: string; group?: string };

export const GENDER: Opt[] = [
  { value: "f", ru: "Женщина", uz: "Ayol" },
  { value: "m", ru: "Мужчина", uz: "Erkak" },
];

// Ревью оунера Экран 5: gender-conditional лейблы (холост/не была; вдовец/вдова)
// через getGenderedOptionLabel — см. gender-wording.ts. Добавлены divorcing +
// married_separate (требуют модерации, IF/THEN в family route). «Предыдущий опыт
// отношений» (женщины) НЕ добавляем — sensitive PD (legal-blocked). marital_status
// = text без CHECK → новые значения без миграции.
export const MARITAL_STATUS: Opt[] = [
  { value: "never", ru: "Никогда не был(а) в браке", uz: "Hech qachon turmush qurmagan" },
  { value: "divorcing", ru: "В процессе развода", uz: "Ajrashish jarayonida" },
  { value: "divorced", ru: "В разводе", uz: "Ajrashgan" },
  { value: "widowed", ru: "Вдовец / вдова", uz: "Beva" },
  { value: "married_separate", ru: "В браке, но живу отдельно", uz: "Nikohda, lekin alohida yashayman" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];
/** marital_status значения, требующие ручной модерации перед публикацией
 *  (ревью оунера: спорный статус — не выпускать в matching автоматически). */
export const MARITAL_STATUS_NEEDS_REVIEW = ["divorcing", "married_separate"] as const;

export const HAS_CHILDREN: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "yes", ru: "Да", uz: "Ha" },
];

export const CHILDREN_PLAN: Opt[] = [
  { value: "want", ru: "Хочу детей в будущем", uz: "Kelajakda farzand xohlayman" },
  { value: "have_maybe_more", ru: "Есть дети, возможно ещё", uz: "Farzandlarim bor, yana boʻlishi mumkin" },
  { value: "have_no_more", ru: "Есть дети, больше не планирую", uz: "Farzandlarim bor, koʻproq rejalashtirmayman" },
  { value: "unsure", ru: "Пока не знаю", uz: "Hozircha bilmayman" },
  { value: "open", ru: "Готов(а) обсудить", uz: "Muhokama qilishga tayyorman" },
];

export const RELIGION: Opt[] = [
  { value: "islam", ru: "Ислам", uz: "Islom" },
  { value: "christianity", ru: "Христианство", uz: "Xristianlik" },
  { value: "judaism", ru: "Иудаизм", uz: "Yahudiylik" },
  { value: "buddhism", ru: "Буддизм", uz: "Buddizm" },
  { value: "other", ru: "Другая религия", uz: "Boshqa din" },
  { value: "none", ru: "Не исповедую религию", uz: "Dinga eʼtiqod qilmayman" },
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
];

export const EMPLOYMENT: Opt[] = [
  { value: "full", ru: "Полная занятость", uz: "Toʻliq bandlik" },
  { value: "part", ru: "Частичная занятость", uz: "Qisman bandlik" },
  { value: "business", ru: "Свой бизнес", uz: "Oʻz biznesi" },
  { value: "freelance", ru: "Свободный график", uz: "Erkin jadval" },
  { value: "studying", ru: "Учусь", uz: "Oʻqiyapman" },
  { value: "home_family", ru: "Дом и семья", uz: "Uy va oila" },
  { value: "unemployed", ru: "Временно не работаю", uz: "Vaqtincha ishlamayapman" },
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
    value: "same_religion",
    ru: "Важно: та же религия",
    uz: "Muhim: bir xil din",
  },
  {
    value: "same_religion_same_practice",
    ru: "Важно: та же религия и регулярная практика",
    uz: "Muhim: bir xil din va muntazam diniy amal",
  },
  {
    value: "close_values",
    ru: "Важно, чтобы религиозные ценности были близки",
    uz: "Diniy qadriyatlar yaqin boʻlishi muhim",
  },
  {
    value: "mutual_respect",
    ru: "С уважением отношусь к разным религиозным взглядам",
    uz: "Turli diniy qarashlarga hurmat bilan qarayman",
  },
  {
    value: "not_decisive",
    ru: "Для меня это не решающий критерий",
    uz: "Bu men uchun hal qiluvchi mezon emas",
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
    ru: "Пока не решил(а)",
    uz: "Hali qaror qilmaganman",
  },
];

/** Когда рассматривает брак — сроки (ревью оунера Экран 11). Матчинг-сигнал темпа. */
export const MARRIAGE_READINESS: Opt[] = [
  { value: "within_6m", ru: "В ближайшие 6 месяцев", uz: "Yaqin 6 oy ichida" },
  { value: "within_1y", ru: "В течение 1 года", uz: "1 yil ichida" },
  { value: "within_2y", ru: "В течение 1–2 лет", uz: "1–2 yil ichida" },
  { value: "when_right", ru: "Когда встречу подходящего человека", uz: "Mos insonni uchratganimda" },
  { value: "not_ready", ru: "Пока не готов(а), хочу сначала познакомиться", uz: "Hozircha tayyor emasman, avval tanishishni xohlayman" },
];

/** Готовность к переезду (ревью оунера — город/страна раздельно). ≠ geo_preference. */
export const RELOCATION_READINESS: Opt[] = [
  { value: "city", ru: "Готов(а) переехать в другой город", uz: "Boshqa shaharga koʻchishga tayyorman" },
  { value: "country", ru: "Готов(а) переехать в другую страну", uz: "Boshqa mamlakatga koʻchishga tayyorman" },
  { value: "by_agreement", ru: "Готов(а) рассмотреть переезд по договорённости", uz: "Kelishuv asosida koʻchishni koʻrib chiqaman" },
  { value: "only_my_city", ru: "Хочу остаться в своём городе", uz: "Oʻz shahrimda qolishni xohlayman" },
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

/** Экран 4 — Текущий статус занятости (ревью оунера). Primary поле. */
export const EMPLOYMENT_STATUS: Opt[] = [
  { value: "working", ru: "Работаю", uz: "Ishlayman" },
  { value: "entrepreneur", ru: "Предприниматель / свой бизнес", uz: "Tadbirkor / oʻz biznesim bor" },
  { value: "freelancer", ru: "Фрилансер", uz: "Frilanser" },
  { value: "student", ru: "Студент / студентка", uz: "Talaba" },
  { value: "home_family", ru: "Занимаюсь домом / семьёй", uz: "Uy va oila bilan shugʻullanaman" },
  { value: "not_working", ru: "Сейчас не работаю", uz: "Hozircha ishlamayman" },
];

/** Экран 4 — Формат работы (условно: показывается при working/entrepreneur/freelancer). */
export const EMPLOYMENT_FORMAT: Opt[] = [
  { value: "office", ru: "Офис", uz: "Ofis" },
  { value: "remote", ru: "Удалённо", uz: "Masofadan" },
  { value: "hybrid", ru: "Гибрид", uz: "Gibrid" },
  { value: "own_business", ru: "Свой бизнес", uz: "Oʻz biznesi" },
  { value: "not_working", ru: "Не работаю сейчас", uz: "Hozir ishlamayman" },
];

/** Статусы, при которых показываем «Формат работы». */
export const EMPLOYMENT_WORKING_STATUSES = ["working", "entrepreneur", "freelancer"] as const;

/** Экран 5 — План по детям в будущем. Заменяет deprecated CHILDREN_PLAN. */
export const FUTURE_CHILDREN_PLAN: Opt[] = [
  { value: "yes_soon", ru: "Да, в ближайшее время", uz: "Ha, yaqin orada" },
  { value: "yes_later", ru: "Да, в будущем", uz: "Ha, kelajakda" },
  { value: "maybe", ru: "Возможно", uz: "Balki" },
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "with_partner_decide", ru: "Решим вместе с партнёром", uz: "Hamroh bilan birga qaror qilamiz" },
  // Ревью оунера Экран 5: «этот вопрос обсуждается индивидуально» (не жёсткий вывод).
  { value: "individual", ru: "Обсуждается индивидуально", uz: "Alohida muhokama qilinadi" },
];

/** Экран 5: с кем сейчас проживают дети (cold, extended.family, показывается
 *  только если has_children='yes'). Необязательное. */
export const CHILDREN_LIVING: Opt[] = [
  { value: "with_me", ru: "Со мной", uz: "Men bilan" },
  { value: "with_other_parent", ru: "С другим родителем", uz: "Boshqa ota-ona bilan" },
  { value: "with_relatives", ru: "С родственниками", uz: "Qarindoshlar bilan" },
  { value: "separate", ru: "Отдельно / самостоятельно", uz: "Alohida / mustaqil" },
];

// Ревью оунера Экран 5: количество детей — бакеты (не свободный ввод). Форма
// маппит value в int (4plus→4, na→null) для hot-колонки children_count.
export const CHILDREN_COUNT: Opt[] = [
  { value: "1", ru: "1", uz: "1" },
  { value: "2", ru: "2", uz: "2" },
  { value: "3", ru: "3", uz: "3" },
  { value: "4plus", ru: "4 и более", uz: "4 va undan koʻp" },
];

// Ревью оунера Экран 5: возраст детей — диапазоны (не точный возраст). COLD →
// extended.family.children_age_range (заменяет youngest_child_age).
export const CHILDREN_AGE_RANGE: Opt[] = [
  { value: "0_3", ru: "До 3 лет", uz: "3 yoshgacha" },
  { value: "3_6", ru: "3–6 лет", uz: "3–6 yosh" },
  { value: "7_12", ru: "7–12 лет", uz: "7–12 yosh" },
  { value: "13_17", ru: "13–17 лет", uz: "13–17 yosh" },
  { value: "18plus", ru: "18+", uz: "18+" },
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
  // Спек 1.6: поле required, но с escape-вариантом «не отвечать».
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
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
];

/** Жильё (owner spec §9). Cold в extended.finance, hidden public (без стигмы «нет дома»). */
export const HOUSING_STATUS: Opt[] = [
  { value: "own", ru: "Своё жильё", uz: "Shaxsiy uy-joyim bor" },
  { value: "rent", ru: "Аренда", uz: "Ijarada yashayman" },
  { value: "with_parents", ru: "С родителями / родственниками", uz: "Ota-onam / qarindoshlarim bilan yashayman" },
  { value: "none", ru: "Пока нет своего жилья", uz: "Hozircha shaxsiy uy-joyim yoʻq" },
];

// ---------- Образ жизни и привычки (Чат-2 Экран 10) ----------

/** Ритм / образ жизни. */
export const LIFESTYLE_PACE: Opt[] = [
  { value: "active", ru: "Активный", uz: "Faol" },
  { value: "calm", ru: "Спокойный", uz: "Tinch" },
  { value: "balanced", ru: "Сбалансированный", uz: "Muvozanatli" },
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

/** Режим дня (по ревью оунера — рамка «во сколько ложусь», а не «подъём»). */
export const DAILY_ROUTINE: Opt[] = [
  { value: "early", ru: "Ранний режим — обычно ложусь до 22:30", uz: "Erta rejim — odatda 22:30 gacha uxlayman" },
  { value: "middle", ru: "Средний режим — ложусь с 22:30 до 00:00", uz: "Oʻrtacha rejim — 22:30 dan 00:00 gacha uxlayman" },
  { value: "late", ru: "Поздний режим — ложусь после 00:00", uz: "Kechki rejim — 00:00 dan keyin uxlayman" },
  { value: "unstable", ru: "Нестабильный режим", uz: "Beqaror rejim" },
];

/** Курение (ранее «вредные привычки» — рефокус на курение по ревью оунера;
 *  алкоголь отдельно, наркотики убраны из анкеты). Hidden public. */
export const BAD_HABITS_LEVEL: Opt[] = [
  { value: "no", ru: "Не курю", uz: "Chekmayman" },
  { value: "sometimes", ru: "Иногда", uz: "Baʼzan" },
  { value: "yes", ru: "Курю", uz: "Chekaman" },
  { value: "quit", ru: "Бросил(а)", uz: "Tashlaganman" },
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
  // Ревью оунера 1.10 (substance): расширено до 4 значений (safety_only). Значение
  // `past` СОХРАНЕНО (у старых юзеров есть drugs_use='past') — не орфаним данные.
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "past", ru: "Было в прошлом, сейчас нет", uz: "Oʻtmishda boʻlgan, hozir yoʻq" },
  { value: "ready_to_discuss", ru: "Есть личная ситуация, готов(а) обсудить со специалистом", uz: "Shaxsiy holat bor, mutaxassis bilan muhokamaga tayyorman" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Ревью оунера 1.15 (§11 Здоровье): важность открытости в вопросах здоровья.
 *  Также переиспользуется для «отношения к здоровью партнёра» (§13 п.6). */
export const HEALTH_OPENNESS: Opt[] = [
  { value: "discuss_before", ru: "Важно обсудить до серьёзного решения", uz: "Jiddiy qarordan oldin muhokama qilish muhim" },
  { value: "discuss_later", ru: "Готов(а) обсудить позже", uz: "Keyinroq muhokama qilishga tayyorman" },
  { value: "not_key", ru: "Для меня это не главный критерий", uz: "Bu men uchun asosiy mezon emas" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Ревью оунера 1.15 (§11): готовность к добровольной совместной медпроверке
 *  перед серьёзным решением о браке. Baxtlilar НЕ собирает результаты. */
export const MEDICAL_CHECK_WILLINGNESS: Opt[] = [
  { value: "yes", ru: "Да, готов(а)", uz: "Ha, tayyorman" },
  { value: "discuss", ru: "Готов(а) обсудить", uz: "Muhokama qilishga tayyorman" },
  { value: "unsure", ru: "Пока не уверен(а)", uz: "Hozircha ishonchim komil emas" },
  { value: "no", ru: "Нет", uz: "Yoʻq" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

// ---------- Кого ищу: страны партнёра (Чат-2: «не делать жёстким фильтром») ----------

/** Multi-select из CITIZENSHIP + «Не имеет значения» (ревью оунера). Soft filter, max 3.
 *  «any» взаимоисключающий: при выборе сбрасывает остальные (логика в форме). */
export const PARTNER_ANY_COUNTRY = "any";
export const PARTNER_PREFERRED_COUNTRIES: Opt[] = [
  { value: PARTNER_ANY_COUNTRY, ru: "Не имеет значения", uz: "Muhim emas" },
  // КЛОНИРУЕМ, а не шарим объекты: `...CITIZENSHIP` копировал бы ССЫЛКИ, и штамп
  // группы (см. OPTION_GROUPS внизу) достался бы этим опциям от CITIZENSHIP —
  // чипы «страны партнёра» читали бы ключи Options.CITIZENSHIP.*, правка
  // Options.PARTNER_PREFERRED_COUNTRIES.* была бы no-op, а правка гражданства
  // молча меняла бы и этот список. Клон = свои ключи и независимое редактирование.
  ...CITIZENSHIP.map((o) => ({ ...o })),
];

// ---------- Кого ищу: доп. ожидания (ревью оунера Экран 12). Cold в extended.partner ----------

/** Приемлемое семейное положение партнёра (multi-select, optional). */
export const PARTNER_MARITAL_PREF: Opt[] = [
  { value: "never_married", ru: "Не был(а) в браке", uz: "Nikohda boʻlmagan" },
  { value: "divorced", ru: "Разведён(а)", uz: "Ajrashgan" },
  { value: "widowed", ru: "Вдовец / вдова", uz: "Beva" },
  { value: "has_experience", ru: "Есть личный опыт, готов(а) обсудить", uz: "Shaxsiy tajribasi bor, muhokamaga tayyor" },
  { value: "any", ru: "Не имеет значения", uz: "Muhim emas" },
];

/** Отношение к детям у партнёра (single, optional). */
export const PARTNER_CHILDREN_PREF: Opt[] = [
  { value: "ok", ru: "Приемлемо", uz: "Qabul qilaman" },
  { value: "discuss", ru: "Готов(а) обсудить индивидуально", uz: "Alohida muhokamaga tayyorman" },
  { value: "prefer_none", ru: "Предпочитаю партнёра без детей", uz: "Farzandsiz juftni afzal koʻraman" },
  { value: "not_decisive", ru: "Для меня это не решающий критерий", uz: "Bu men uchun hal qiluvchi mezon emas" },
];

/** Важность родного региона партнёра (single, optional). */
export const PARTNER_ORIGIN_REGION_PREF: Opt[] = [
  { value: "same_as_mine", ru: "Желательно из моего родного региона", uz: "Mening kelib chiqish hududimdan boʻlsa yaxshi" },
  { value: "any", ru: "Регион не имеет значения", uz: "Hudud muhim emas" },
  { value: "open", ru: "Готов(а) рассмотреть разные варианты", uz: "Turli variantlarni koʻrib chiqishga tayyorman" },
];

/** Ревью оунера 1.14: предпочтение по национальности партнёра (single).
 *  «Выбрать конкретно» → показать список PARTNER_NATIONALITY. Soft-фильтр,
 *  cold (extended.partner), в matching НЕ энфорсится. */
export const PARTNER_NATIONALITY_PREF: Opt[] = [
  { value: "any", ru: "Не имеет значения", uz: "Muhim emas" },
  { value: "preferably_mine", ru: "Желательно моя национальность", uz: "Mening millatim boʻlsa yaxshi" },
  { value: "open_to_different", ru: "Готов(а) рассмотреть разные варианты", uz: "Turli variantlarni koʻrib chiqishga tayyorman" },
  { value: "specific", ru: "Выбрать конкретно", uz: "Aniq tanlash" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Ревью оунера 1.14: список национальностей (multi-select, показывается при
 *  partner_nationality_pref = specific). Значения — ровно как в спеке оунера. */
export const PARTNER_NATIONALITY: Opt[] = [
  { value: "uzbek", ru: "Узбекская", uz: "Oʻzbek" },
  { value: "karakalpak", ru: "Каракалпакская", uz: "Qoraqalpoq" },
  { value: "tajik", ru: "Таджикская", uz: "Tojik" },
  { value: "kazakh", ru: "Казахская", uz: "Qozoq" },
  { value: "kyrgyz", ru: "Киргизская", uz: "Qirgʻiz" },
  { value: "turkmen", ru: "Туркменская", uz: "Turkman" },
  { value: "russian", ru: "Русская", uz: "Rus" },
  { value: "tatar", ru: "Татарская", uz: "Tatar" },
  { value: "korean", ru: "Корейская", uz: "Koreys" },
  { value: "turkish", ru: "Турецкая", uz: "Turk" },
  { value: "arab", ru: "Арабская", uz: "Arab" },
  { value: "uyghur", ru: "Уйгурская", uz: "Uygʻur" },
  { value: "azeri", ru: "Азербайджанская", uz: "Ozarbayjon" },
  { value: "afghan", ru: "Афганская", uz: "Afgʻon" },
  { value: "iranian", ru: "Иранская", uz: "Eronlik" },
  { value: "indian", ru: "Индийская", uz: "Hind" },
  { value: "pakistani", ru: "Пакистанская", uz: "Pokistonlik" },
  { value: "european", ru: "Европейская", uz: "Yevropalik" },
  { value: "mixed", ru: "Смешанное происхождение", uz: "Aralash kelib chiqish" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
  { value: "prefer_not_to_answer", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

/** Экран 12: hard/soft-переключатель (ревью оунера). Какие из ожиданий к партнёру
 *  для пользователя ПРИНЦИПИАЛЬНЫ (не обсуждаются). Multi-select, cold (extended.partner),
 *  пусто = все критерии гибкие. Пока ИНФОРМАЦИОННОЕ поле (для match-story/кураторства),
 *  в тюнингованном get_recommendations НЕ энфорсится — matching не трогаем. */
export const PARTNER_HARD_CRITERIA: Opt[] = [
  { value: "age", ru: "Возраст", uz: "Yosh" },
  { value: "religion", ru: "Религия и вера", uz: "Din va eʼtiqod" },
  { value: "marital", ru: "Семейное положение", uz: "Oilaviy holat" },
  { value: "children", ru: "Наличие детей", uz: "Farzandlar borligi" },
  { value: "region", ru: "Регион и происхождение", uz: "Hudud va kelib chiqishi" },
  { value: "height", ru: "Рост", uz: "Boʻy" },
];

// ---------- Типы фото (Экран 13) ----------
// portrait — главное, видно ДО взаимного интереса; full_body — видно pre-mutual;
// family — чувствительное, только post-mutual (см. миграцию 20260711020000 +
// gender-conditional privacy в get_recommendations). Порядок = порядок слотов в форме.
export const PHOTO_TYPE: Opt[] = [
  { value: "portrait", ru: "Портрет", uz: "Portret" },
  { value: "full_body", ru: "В полный рост", uz: "Toʻliq boʻy" },
  { value: "family", ru: "Семейное", uz: "Oilaviy" },
];
/** Типы, которые видны в ленте рекомендаций ДО взаимного интереса. */
// Ревью оунера 1.18: полный рост — только ПОСЛЕ взаимного интереса (как и family).
// До взаимного интереса виден только портрет; полная галерея — в RevealedProfile.
export const PHOTO_TYPES_PRE_MUTUAL = ["portrait"] as const;

// ---------- Районы УЗ (cascading per region) ----------
// Реэкспорт из src/lib/profile/uz-districts.ts, где живут ~98 записей
// по 6 крупнейшим регионам (Phase 1). Остальные регионы — freeform fallback.
export { UZ_DISTRICTS_BY_REGION, hasDistrictList } from "./uz-districts";

// ---------- Экран 6 «Родители и участие семьи» (2026-07-12) ----------
// Всё COLD в extended.parents. Статус отца/матери — единые value, гендерные
// лейблы (Жив/Жива, Ушёл/Ушла). «Предпочитаю не отвечать» здесь ЕСТЬ намеренно —
// родители = чувствительный контекст (исключение из общей чистки prefer-not).

export const FATHER_STATUS: Opt[] = [
  { value: "alive", ru: "Жив", uz: "Hayotda" },
  { value: "deceased", ru: "Ушёл из жизни", uz: "Vafot etgan" },
  { value: "no_contact", ru: "Нет связи / не общаемся", uz: "Aloqa yoʻq / muloqot qilmaymiz" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

export const MOTHER_STATUS: Opt[] = [
  { value: "alive", ru: "Жива", uz: "Hayotda" },
  { value: "deceased", ru: "Ушла из жизни", uz: "Vafot etgan" },
  { value: "no_contact", ru: "Нет связи / не общаемся", uz: "Aloqa yoʻq / muloqot qilmaymiz" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

export const PARENT_AGE_RANGE: Opt[] = [
  { value: "under_45", ru: "До 45 лет", uz: "45 yoshgacha" },
  { value: "45_54", ru: "45–54", uz: "45–54" },
  { value: "55_64", ru: "55–64", uz: "55–64" },
  { value: "65_plus", ru: "65 и старше", uz: "65 va undan katta" },
];

export const PARENT_PROFESSION: Opt[] = [
  { value: "gov_service", ru: "Государственная служба", uz: "Davlat xizmati" },
  { value: "business", ru: "Бизнес / предпринимательство", uz: "Biznes / tadbirkorlik" },
  { value: "education_science", ru: "Образование / наука", uz: "Taʼlim / ilm-fan" },
  { value: "medicine", ru: "Медицина / здоровье", uz: "Tibbiyot / sogʻliqni saqlash" },
  { value: "agriculture", ru: "Сельское хозяйство", uz: "Qishloq xoʻjaligi" },
  { value: "manufacturing", ru: "Производство / промышленность", uz: "Ishlab chiqarish / sanoat" },
  { value: "trade_services", ru: "Торговля / услуги", uz: "Savdo / xizmat koʻrsatish" },
  { value: "religious", ru: "Религиозная / духовная сфера", uz: "Diniy / maʼnaviy soha" },
  { value: "home_family", ru: "Дом и семья", uz: "Uy va oila" },
  { value: "retired", ru: "На пенсии", uz: "Nafaqada" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];

export const PARENTS_MARITAL: Opt[] = [
  { value: "together", ru: "Родители вместе", uz: "Ota-onam birga" },
  { value: "divorced", ru: "Родители разведены", uz: "Ota-onam ajrashgan" },
  { value: "father_deceased", ru: "Отец ушёл из жизни", uz: "Otam vafot etgan" },
  { value: "mother_deceased", ru: "Мать ушла из жизни", uz: "Onam vafot etgan" },
  { value: "both_deceased", ru: "Оба родителя ушли из жизни", uz: "Ikkalasi ham vafot etgan" },
  { value: "other", ru: "Другое", uz: "Boshqa" },
];

/** Ревью оунера 1.5: «Сколько лет родители вместе?» — показывать, только если
 *  parents_marital = together. COLD (extended.parents), optional. */
export const PARENTS_YEARS_TOGETHER: Opt[] = [
  { value: "under_5", ru: "До 5 лет", uz: "5 yildan kam" },
  { value: "5_10", ru: "5–10 лет", uz: "5–10 yil" },
  { value: "11_20", ru: "11–20 лет", uz: "11–20 yil" },
  { value: "21_30", ru: "21–30 лет", uz: "21–30 yil" },
  { value: "over_30", ru: "Более 30 лет", uz: "30 yildan ortiq" },
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

export const FAMILY_RELATIONS: Opt[] = [
  { value: "close", ru: "Близкие", uz: "Yaqin" },
  { value: "normal", ru: "Обычные", uz: "Oddiy" },
  { value: "rare", ru: "Редко общаемся", uz: "Kam muloqot qilamiz" },
  { value: "separate_connected", ru: "Живу отдельно, но связь поддерживаю", uz: "Alohida yashayman, lekin aloqadamiz" },
];

export const FAMILY_INVOLVEMENT: Opt[] = [
  { value: "family_aware", ru: "Для меня важно, чтобы семья была в курсе", uz: "Oilam xabardor boʻlishi men uchun muhim" },
  { value: "family_consultation", ru: "Я хочу советоваться с семьёй", uz: "Oilam bilan maslahatlashishni xohlayman" },
  { value: "independent", ru: "Решение принимаю самостоятельно", uz: "Qarorni mustaqil qabul qilaman" },
  { value: "depends", ru: "Это зависит от ситуации", uz: "Vaziyatga bogʻliq" },
  // Требование оунера: поле обязательно, но с escape-вариантом «не отвечать».
  { value: "prefer_not", ru: "Предпочитаю не отвечать", uz: "Javob berishni xohlamayman" },
];

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);

/** БАЗОВЫЙ лейбл из кода (ru/uz). Fallback, когда переводчик недоступен
 * (админка вне next-intl) или ключа нет в messages. DB-редактируемый лейбл —
 * см. optLabel() в ./option-label. */
export const labelOf = (o: Opt[], value: string, locale: string): string =>
  o.find((x) => x.value === value)?.[locale === "uz" ? "uz" : "ru"] ?? value;

// ─────────────────────────────────────────────────────────────────────────────
// Конструктор текстовок Tier 2: реестр групп + проставление `group`.
//
// Зачем реестр: лейбл варианта редактируется в админке как обычная i18n-строка
// с ключом `Options.<GROUP>.<value>`. Чтобы рендер знал этот ключ, каждый Opt
// носит имя своей группы.
//
// Почему ШТАМПУЕМ поле, а не ищем группу по ссылке на массив: формы строят
// производные массивы (`MARITAL_STATUS.map((o) => ({ ...o, … }))` в
// AnketaFamilyForm/AnketaFamilyModelForm) — спред СОХРАНЯЕТ `group`, но теряет
// ссылочную идентичность массива. Штамп переживает производные массивы.
//
// COUNTRY_OF_RESIDENCE === CITIZENSHIP (тот же массив тех же объектов) →
// намеренно делит ключи `Options.CITIZENSHIP.*`; лейблы идентичны.
// ─────────────────────────────────────────────────────────────────────────────

export const OPTION_GROUPS: Record<string, Opt[]> = {
  GENDER, MARITAL_STATUS, HAS_CHILDREN, CHILDREN_PLAN, RELIGION, LIFE_VALUES,
  EDUCATION, EMPLOYMENT, GEO_PREFERENCE, CITIZENSHIP, UZ_REGIONS, LANGUAGES_LIST,
  RELIGION_PRACTICE, RELIGION_PARTNER_MATCH, POST_MARRIAGE_LIVING, MARRIAGE_READINESS,
  RELOCATION_READINESS, ACTIVITY_FIELDS, EMPLOYMENT_STATUS, EMPLOYMENT_FORMAT,
  FUTURE_CHILDREN_PLAN, CHILDREN_LIVING, CHILDREN_COUNT, CHILDREN_AGE_RANGE,
  LIFE_VALUES_V3, FAMILY_ROLE_MODEL, WIFE_WORK_VIEW, FAMILY_DECISION_MODEL,
  HOUSEHOLD_RESPONSIBILITY_MODEL, SEPARATE_FROM_PARENTS_IMPORTANCE, PARTNER_QUALITIES,
  PROFILE_VISIBILITY_MODE, INCOME_SOURCE_STABILITY, FAMILY_FINANCE_MANAGEMENT,
  FINANCIAL_PRIORITIES, MONTHLY_INCOME_RANGE, FINANCIAL_OBLIGATIONS, HOUSING_STATUS,
  LIFESTYLE_PACE, FREE_TIME_ACTIVITIES, DAILY_ROUTINE, BAD_HABITS_LEVEL, NUTRITION_STYLE,
  ALCOHOL_LEVEL, DRUGS_USE, HEALTH_OPENNESS, MEDICAL_CHECK_WILLINGNESS,
  PARTNER_PREFERRED_COUNTRIES, PARTNER_MARITAL_PREF,
  PARTNER_CHILDREN_PREF, PARTNER_ORIGIN_REGION_PREF, PARTNER_NATIONALITY_PREF,
  PARTNER_NATIONALITY, PARTNER_HARD_CRITERIA, PHOTO_TYPE,
  FATHER_STATUS, MOTHER_STATUS, PARENT_AGE_RANGE, PARENT_PROFESSION, PARENTS_MARITAL,
  PARENTS_YEARS_TOGETHER, FAMILY_RELATIONS, FAMILY_INVOLVEMENT,
};

// Одноразовый штамп при импорте модуля. Идемпотентен (guard на !o.group), поэтому
// алиас COUNTRY_OF_RESIDENCE не переписывает уже проставленный CITIZENSHIP.
for (const [name, arr] of Object.entries(OPTION_GROUPS)) {
  for (const o of arr) if (!o.group) o.group = name;
}

/** Ключ редактируемого лейбла внутри i18n-namespace `Options`. */
export const optionLabelKey = (opt: Opt): string | null =>
  opt.group ? `${opt.group}.${opt.value}` : null;
