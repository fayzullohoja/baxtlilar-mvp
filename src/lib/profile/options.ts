// Списки опций лайт-анкеты (значение + ru/uz лейблы). Заземлено на Чат 2.
export type Opt = { value: string; ru: string; uz: string; tr?: string };

export const GENDER: Opt[] = [
  { value: "f", ru: "Женщина", uz: "Ayol", tr: "Kadın" },
  { value: "m", ru: "Мужчина", uz: "Erkak", tr: "Erkek" },
];

export const MARITAL_STATUS: Opt[] = [
  { value: "never", ru: "Никогда не был(а) в браке", uz: "Hech qachon turmush qurmagan", tr: "Hiç evlenmemiş" },
  { value: "divorced", ru: "В разводе", uz: "Ajrashgan", tr: "Boşanmış" },
  { value: "widowed", ru: "Вдовец / вдова", uz: "Beva", tr: "Dul" },
  { value: "other", ru: "Другое", uz: "Boshqa", tr: "Diğer" },
];

export const HAS_CHILDREN: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq", tr: "Hayır" },
  { value: "yes", ru: "Да", uz: "Ha", tr: "Evet" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
];

export const CHILDREN_PLAN: Opt[] = [
  { value: "want", ru: "Хочу детей в будущем", uz: "Kelajakda farzand xohlayman", tr: "Gelecekte çocuk istiyorum" },
  { value: "have_maybe_more", ru: "Есть дети, возможно ещё", uz: "Farzandlarim bor, yana boʻlishi mumkin", tr: "Çocuğum var, belki daha fazla" },
  { value: "have_no_more", ru: "Есть дети, больше не планирую", uz: "Farzandlarim bor, koʻproq rejalashtirmayman", tr: "Çocuğum var, daha fazla düşünmüyorum" },
  { value: "unsure", ru: "Пока не знаю", uz: "Hozircha bilmayman", tr: "Henüz bilmiyorum" },
  { value: "open", ru: "Готов(а) обсудить", uz: "Muhokama qilishga tayyorman", tr: "Konuşmaya açığım" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
];

export const RELIGION: Opt[] = [
  { value: "islam", ru: "Ислам", uz: "Islom", tr: "İslam" },
  { value: "christianity", ru: "Христианство", uz: "Xristianlik", tr: "Hristiyanlık" },
  { value: "judaism", ru: "Иудаизм", uz: "Yahudiylik", tr: "Yahudilik" },
  { value: "buddhism", ru: "Буддизм", uz: "Buddizm", tr: "Budizm" },
  { value: "other", ru: "Другая религия", uz: "Boshqa din", tr: "Diğer din" },
  { value: "none", ru: "Не исповедую религию", uz: "Dinga eʼtiqod qilmayman", tr: "Herhangi bir dine mensup değilim" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
];

export const LIFE_VALUES: Opt[] = [
  { value: "family", ru: "Семья и отношения", uz: "Oila va munosabatlar", tr: "Aile ve ilişkiler" },
  { value: "faith", ru: "Духовность и вера", uz: "Maʼnaviyat va eʼtiqod", tr: "Maneviyat ve inanç" },
  { value: "honesty", ru: "Честность и порядочность", uz: "Halollik va poklik", tr: "Dürüstlük ve doğruluk" },
  { value: "growth", ru: "Развитие и обучение", uz: "Rivojlanish va oʻrganish", tr: "Gelişim ve öğrenme" },
  { value: "health", ru: "Здоровье", uz: "Sogʻliq", tr: "Sağlık" },
  { value: "career", ru: "Карьера и самореализация", uz: "Karyera va oʻzini namoyon qilish", tr: "Kariyer ve kendini gerçekleştirme" },
  { value: "finance", ru: "Финансовая стабильность", uz: "Moliyaviy barqarorlik", tr: "Finansal istikrar" },
  { value: "helping", ru: "Помощь другим", uz: "Boshqalarga yordam", tr: "Başkalarına yardım" },
  { value: "freedom", ru: "Свобода и самостоятельность", uz: "Erkinlik va mustaqillik", tr: "Özgürlük ve bağımsızlık" },
];

export const EDUCATION: Opt[] = [
  { value: "secondary", ru: "Среднее", uz: "Oʻrta", tr: "Lise" },
  { value: "vocational", ru: "Среднее специальное", uz: "Oʻrta maxsus", tr: "Meslek lisesi" },
  { value: "higher", ru: "Высшее / Бакалавр", uz: "Oliy / Bakalavr", tr: "Lisans" },
  { value: "master", ru: "Магистр", uz: "Magistr", tr: "Yüksek lisans" },
  { value: "phd", ru: "PhD / учёная степень", uz: "PhD / ilmiy daraja", tr: "Doktora / akademik derece" }, // V5 owner spec
  { value: "studying", ru: "Учусь сейчас", uz: "Hozir oʻqiyapman", tr: "Şu anda okuyorum" },
  { value: "courses", ru: "Проф. курсы", uz: "Kasbiy kurslar", tr: "Mesleki kurslar" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
];

export const EMPLOYMENT: Opt[] = [
  { value: "full", ru: "Полная занятость", uz: "Toʻliq bandlik", tr: "Tam zamanlı" },
  { value: "part", ru: "Частичная занятость", uz: "Qisman bandlik", tr: "Yarı zamanlı" },
  { value: "business", ru: "Свой бизнес", uz: "Oʻz biznesi", tr: "Kendi işim" },
  { value: "freelance", ru: "Свободный график", uz: "Erkin jadval", tr: "Serbest çalışma" },
  { value: "studying", ru: "Учусь", uz: "Oʻqiyapman", tr: "Öğrenciyim" },
  { value: "home_family", ru: "Дом и семья", uz: "Uy va oila", tr: "Ev ve aile" },
  { value: "unemployed", ru: "Временно не работаю", uz: "Vaqtincha ishlamayapman", tr: "Geçici olarak çalışmıyorum" },
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
];

export const GEO_PREFERENCE: Opt[] = [
  { value: "my_city", ru: "В моём городе", uz: "Mening shahrimda", tr: "Şehrimde" },
  { value: "country", ru: "По всей стране", uz: "Butun mamlakat boʻylab", tr: "Ülke genelinde" },
];

// ============================================================================
// Onboarding V2 Extension (2026-06-28) — продуктовые поправки
// ============================================================================

/** Гражданство. Список СНГ + Турция + другое. */
export const CITIZENSHIP: Opt[] = [
  { value: "UZ", ru: "Узбекистан", uz: "Oʻzbekiston", tr: "Özbekistan" },
  { value: "RU", ru: "Россия", uz: "Rossiya", tr: "Rusya" },
  { value: "KZ", ru: "Казахстан", uz: "Qozogʻiston", tr: "Kazakistan" },
  { value: "KG", ru: "Киргизия", uz: "Qirgʻiziston", tr: "Kırgızistan" },
  { value: "TJ", ru: "Таджикистан", uz: "Tojikiston", tr: "Tacikistan" },
  { value: "TM", ru: "Туркменистан", uz: "Turkmaniston", tr: "Türkmenistan" },
  { value: "TR", ru: "Турция", uz: "Turkiya", tr: "Türkiye" },
  // Anketa V5 (owner spec 2026-07-07): расширение списка стран.
  { value: "US", ru: "США", uz: "AQSH", tr: "ABD" },
  { value: "KR", ru: "Южная Корея", uz: "Janubiy Koreya", tr: "Güney Kore" },
  { value: "JP", ru: "Япония", uz: "Yaponiya", tr: "Japonya" },
  { value: "SA", ru: "Саудовская Аравия", uz: "Saudiya Arabistoni", tr: "Suudi Arabistan" },
  { value: "AE", ru: "ОАЭ", uz: "BAA", tr: "BAE" },
  { value: "QA", ru: "Катар", uz: "Qatar", tr: "Katar" },
  { value: "ID", ru: "Индонезия", uz: "Indoneziya", tr: "Endonezya" },
  { value: "MY", ru: "Малайзия", uz: "Malayziya", tr: "Malezya" },
  { value: "OTHER", ru: "Другое", uz: "Boshqa", tr: "Diğer" },
];

/** Страна фактического проживания. Те же опции что у CITIZENSHIP. */
export const COUNTRY_OF_RESIDENCE: Opt[] = CITIZENSHIP;

/** Регионы Узбекистана (для country_of_residence='UZ'). 12 областей + 2 особых. */
export const UZ_REGIONS: Opt[] = [
  { value: "tashkent_city", ru: "г. Ташкент", uz: "Toshkent sh.", tr: "Taşkent şehri" },
  { value: "tashkent_region", ru: "Ташкентская область", uz: "Toshkent vil.", tr: "Taşkent bölgesi" },
  { value: "andijan", ru: "Андижанская область", uz: "Andijon vil.", tr: "Andican bölgesi" },
  { value: "bukhara", ru: "Бухарская область", uz: "Buxoro vil.", tr: "Buhara bölgesi" },
  { value: "fergana", ru: "Ферганская область", uz: "Fargʻona vil.", tr: "Fergana bölgesi" },
  { value: "jizzakh", ru: "Джизакская область", uz: "Jizzax vil.", tr: "Cizzah bölgesi" },
  { value: "kashkadarya", ru: "Кашкадарьинская область", uz: "Qashqadaryo vil.", tr: "Kaşkaderya bölgesi" },
  { value: "khorezm", ru: "Хорезмская область", uz: "Xorazm vil.", tr: "Harezm bölgesi" },
  { value: "namangan", ru: "Наманганская область", uz: "Namangan vil.", tr: "Namangan bölgesi" },
  { value: "navoiy", ru: "Навоийская область", uz: "Navoiy vil.", tr: "Nevai bölgesi" },
  { value: "samarkand", ru: "Самаркандская область", uz: "Samarqand vil.", tr: "Semerkant bölgesi" },
  { value: "sirdaryo", ru: "Сырдарьинская область", uz: "Sirdaryo vil.", tr: "Sirderya bölgesi" },
  { value: "surkhandarya", ru: "Сурхандарьинская область", uz: "Surxondaryo vil.", tr: "Surhanderya bölgesi" },
  { value: "karakalpakstan", ru: "Каракалпакстан", uz: "Qoraqalpogʻiston", tr: "Karakalpakistan" },
];

/** Языки. Используется и для native_language (single), и для languages[] (multi). */
export const LANGUAGES_LIST: Opt[] = [
  { value: "uz", ru: "Узбекский", uz: "Oʻzbek", tr: "Özbekçe" },
  { value: "ru", ru: "Русский", uz: "Rus", tr: "Rusça" },
  { value: "kaa", ru: "Каракалпакский", uz: "Qoraqalpoq", tr: "Karakalpakça" },
  { value: "kk", ru: "Казахский", uz: "Qozoq", tr: "Kazakça" },
  { value: "ky", ru: "Киргизский", uz: "Qirgʻiz", tr: "Kırgızca" },
  { value: "tg", ru: "Таджикский", uz: "Tojik", tr: "Tacikçe" },
  { value: "tk", ru: "Туркменский", uz: "Turkman", tr: "Türkmence" },
  { value: "tr", ru: "Турецкий", uz: "Turk", tr: "Türkçe" },
  { value: "en", ru: "Английский", uz: "Ingliz", tr: "İngilizce" },
  { value: "ar", ru: "Арабский", uz: "Arab", tr: "Arapça" },
  { value: "other", ru: "Другой", uz: "Boshqa", tr: "Diğer" },
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
  { value: "within_3m", ru: "В течение 3 месяцев", uz: "3 oy ichida", tr: "3 ay içinde" },
  { value: "within_6m", ru: "В течение 6 месяцев", uz: "6 oy ichida", tr: "6 ay içinde" },
  { value: "within_1y", ru: "В течение года", uz: "1 yil ichida", tr: "Bir yıl içinde" },
  { value: "no_rush", ru: "Не спешу — сначала познакомиться", uz: "Shoshilmayman, avval tanishmoqchiman", tr: "Acelem yok — önce tanışmak isterim" },
  { value: "unsure", ru: "Пока не ясно", uz: "Hali aniq emas", tr: "Henüz belli değil" },
];

/** Готовность к переезду (owner spec §13). ≠ geo_preference (где искать партнёра). */
export const RELOCATION_READINESS: Opt[] = [
  { value: "ready", ru: "Готов(а) переехать в другой город/страну", uz: "Boshqa shahar/mamlakatga koʻchishga tayyorman", tr: "Başka bir şehre/ülkeye taşınmaya hazırım" },
  { value: "only_my_city", ru: "Только в своём городе", uz: "Faqat oʻz shahrimda yashayman", tr: "Yalnızca kendi şehrimde" },
  { value: "by_agreement", ru: "По договорённости", uz: "Kelishuvga qarab", tr: "Anlaşmaya göre" },
  { value: "unsure", ru: "Пока не ясно", uz: "Hali aniq emas", tr: "Henüz belli değil" },
];

// ============================================================================
// Anketa V3 MVP (2026-06-29) — Sprint 1 enum-наборы для новых экранов
// ============================================================================

/** Экран 3 — Деятельность. 17 опций. */
export const ACTIVITY_FIELDS: Opt[] = [
  { value: "it_software", ru: "IT / Разработка", uz: "IT / Dasturlash", tr: "BT / Yazılım Geliştirme" },
  { value: "finance_banking", ru: "Финансы / Банки", uz: "Moliya / Banklar", tr: "Finans / Bankacılık" },
  { value: "education_science", ru: "Образование / Наука", uz: "Taʼlim / Fan", tr: "Eğitim / Bilim" },
  { value: "medicine_health", ru: "Медицина / Здоровье", uz: "Tibbiyot / Sogʻliq", tr: "Tıp / Sağlık" },
  { value: "state_service", ru: "Госслужба", uz: "Davlat xizmati", tr: "Kamu Hizmeti" },
  { value: "law_legal", ru: "Юриспруденция", uz: "Yuristlik", tr: "Hukuk" },
  { value: "business_entrepreneurship", ru: "Бизнес / Предпринимательство", uz: "Biznes / Tadbirkorlik", tr: "İş Dünyası / Girişimcilik" },
  { value: "agriculture", ru: "Сельское хозяйство", uz: "Qishloq xoʻjaligi", tr: "Tarım" },
  { value: "construction_realestate", ru: "Строительство / Недвижимость", uz: "Qurilish / Koʻchmas mulk", tr: "İnşaat / Gayrimenkul" },
  { value: "manufacturing_industry", ru: "Производство / Промышленность", uz: "Ishlab chiqarish", tr: "Üretim / Sanayi" },
  { value: "trade_retail", ru: "Торговля / Розница", uz: "Savdo / Chakana", tr: "Ticaret / Perakende" },
  { value: "transport_logistics", ru: "Транспорт / Логистика", uz: "Transport / Logistika", tr: "Ulaşım / Lojistik" },
  { value: "media_creative", ru: "Медиа / Творчество", uz: "Media / Ijod", tr: "Medya / Sanat" },
  { value: "services", ru: "Услуги / Сервис", uz: "Xizmatlar", tr: "Hizmet Sektörü" },
  { value: "religion_spiritual", ru: "Религия / Духовная сфера", uz: "Din / Maʼnaviyat", tr: "Din / Manevi Alan" },
  { value: "household_homemaker", ru: "Дом и семья", uz: "Uy va oila", tr: "Ev ve Aile" },
  { value: "other", ru: "Другое", uz: "Boshqa", tr: "Diğer" },
];

/** Экран 3 — Формат занятости. */
export const EMPLOYMENT_FORMAT: Opt[] = [
  { value: "office", ru: "Офис", uz: "Ofis", tr: "Ofis" },
  { value: "remote", ru: "Удалённо", uz: "Masofadan", tr: "Uzaktan" },
  { value: "hybrid", ru: "Гибрид", uz: "Gibrid", tr: "Hibrit" },
  { value: "own_business", ru: "Свой бизнес", uz: "Oʻz biznesi", tr: "Kendi işim" },
  { value: "not_working", ru: "Не работаю сейчас", uz: "Hozir ishlamayman", tr: "Şu anda çalışmıyorum" },
];

/** Экран 5 — План по детям в будущем. Заменяет deprecated CHILDREN_PLAN. */
export const FUTURE_CHILDREN_PLAN: Opt[] = [
  { value: "yes_soon", ru: "Да, в ближайшее время", uz: "Ha, yaqin orada", tr: "Evet, yakın zamanda" },
  { value: "yes_later", ru: "Да, в будущем", uz: "Ha, kelajakda", tr: "Evet, ileride" },
  { value: "maybe", ru: "Возможно", uz: "Balki", tr: "Belki" },
  { value: "no", ru: "Нет", uz: "Yoʻq", tr: "Hayır" },
  { value: "with_partner_decide", ru: "Решим вместе с партнёром", uz: "Hamroh bilan birga qaror qilamiz", tr: "Eşimle birlikte karar veririz" },
];

/** Экран 6 — Топ-ценности (1-3 выбора из 14). */
export const LIFE_VALUES_V3: Opt[] = [
  { value: "family", ru: "Семья", uz: "Oila", tr: "Aile" },
  { value: "faith", ru: "Вера", uz: "Eʼtiqod", tr: "İnanç" },
  { value: "honesty", ru: "Честность", uz: "Halollik", tr: "Dürüstlük" },
  { value: "respect", ru: "Уважение", uz: "Hurmat", tr: "Saygı" },
  { value: "kindness", ru: "Доброта", uz: "Mehribonlik", tr: "İyilik" },
  { value: "responsibility", ru: "Ответственность", uz: "Masʼuliyat", tr: "Sorumluluk" },
  { value: "tradition", ru: "Традиции", uz: "Anʼanalar", tr: "Gelenekler" },
  { value: "education", ru: "Образование", uz: "Taʼlim", tr: "Eğitim" },
  { value: "health", ru: "Здоровье", uz: "Sogʻliq", tr: "Sağlık" },
  { value: "career", ru: "Карьера", uz: "Karyera", tr: "Kariyer" },
  { value: "financial_stability", ru: "Финансовая стабильность", uz: "Moliyaviy barqarorlik", tr: "Maddi istikrar" },
  { value: "community", ru: "Община / Махалла", uz: "Hamjamiyat / Mahalla", tr: "Topluluk / Mahalle" },
  { value: "self_development", ru: "Саморазвитие", uz: "Oʻzini rivojlantirish", tr: "Kişisel gelişim" },
  { value: "independence", ru: "Самостоятельность", uz: "Mustaqillik", tr: "Bağımsızlık" },
];

/** Экран 7 — Модель распределения ролей в семье. Ключевой для matching.
 * V5 (owner spec 2026-07-07): 3 варианта (муж/жена/равное), формулировки
 * смягчены; `situational` («зависит от ситуации») убран. */
export const FAMILY_ROLE_MODEL: Opt[] = [
  { value: "traditional", ru: "Семья с лидерством мужчины", uz: "Erkak yetakchiligidagi oila", tr: "Erkeğin öncülük ettiği aile" },
  { value: "woman_leads", ru: "Семья с лидерством женщины", uz: "Ayol yetakchiligidagi oila", tr: "Kadının öncülük ettiği aile" },
  { value: "equal_partnership", ru: "Равное партнёрство", uz: "Oʻzaro teng sheriklik", tr: "Eşit ortaklık" },
];

/** Экран 7 — Взгляд на работу жены после брака. */
export const WIFE_WORK_VIEW: Opt[] = [
  { value: "welcome", ru: "Приветствую — пусть работает", uz: "Mamnuniyat bilan — ishlasin", tr: "Memnuniyetle — çalışabilir" },
  { value: "ok_if_needed", ru: "Допустимо, если нужно", uz: "Kerak boʻlsa, mumkin", tr: "Gerekirse uygun" },
  { value: "prefer_not", ru: "Предпочитаю, чтобы не работала", uz: "Ishlamasligini afzal koʻraman", tr: "Çalışmamasını tercih ederim" },
  { value: "against", ru: "Категорически против", uz: "Qatʼiy qarshi", tr: "Kesinlikle karşıyım" },
  { value: "discuss", ru: "Готов(а) обсуждать", uz: "Muhokama qilishga tayyorman", tr: "Konuşmaya açığım" },
];

/** Экран 7 — Принятие решений (в extended.family.decision_model).
 * V4: `by_domain` удалён (учредитель счёл лишним 4-й вариант). */
export const FAMILY_DECISION_MODEL: Opt[] = [
  { value: "husband_main", ru: "Основное за мужем", uz: "Asosiy qaror erda", tr: "Ağırlıklı olarak koca karar verir" },
  { value: "wife_main", ru: "Основное за женой", uz: "Asosiy qaror xotinda", tr: "Ağırlıklı olarak eş karar verir" },
  { value: "joint", ru: "Совместно", uz: "Birgalikda", tr: "Birlikte" },
];

/** Экран 7 — Бытовые обязанности (в extended.family.household_responsibility_model).
 * V4: `flexible` («Гибко по ситуации») заменён на `mostly_partner` — лейбл
 * подставляется в зависимости от пола пользователя через gender-wording helper:
 *   М-юзер видит «В основном жена», Ж-юзер видит «В основном муж».
 * Базовый ru/uz здесь нейтральный (для админки/preview); в формах используется
 * `getGenderedOptionLabel(HOUSEHOLD_RESPONSIBILITY_MODEL, value, userGender)`. */
export const HOUSEHOLD_RESPONSIBILITY_MODEL: Opt[] = [
  { value: "traditional", ru: "Традиционно (жена — дом, муж — обеспечение)", uz: "Anʼanaviy (xotin uy ishlari, er taʼminlash)", tr: "Geleneksel (eş — ev, koca — geçim)" },
  { value: "shared_50_50", ru: "Поровну 50/50", uz: "Tengma-teng 50/50", tr: "Eşit olarak 50/50" },
  { value: "by_skill", ru: "По навыкам", uz: "Koʻnikma boʻyicha", tr: "Yeteneğe göre" },
  { value: "mostly_partner", ru: "В основном партнёр", uz: "Asosan hamroh", tr: "Çoğunlukla eş" },
];

/** Экран 12 — Важность жить отдельно от родителей (в extended.living). */
export const SEPARATE_FROM_PARENTS_IMPORTANCE: Opt[] = [
  { value: "must", ru: "Обязательно отдельно", uz: "Albatta alohida", tr: "Mutlaka ayrı olmalı" },
  { value: "preferred", ru: "Желательно отдельно", uz: "Alohida boʻlgani yaxshi", tr: "Ayrı olması tercih edilir" },
  { value: "neutral", ru: "Нейтрально", uz: "Farqi yoʻq", tr: "Fark etmez" },
  { value: "not_important", ru: "Не принципиально", uz: "Muhim emas", tr: "Önemli değil" },
];

/** Экран 8 — Топ-качества партнёра (1-5 выбора из 14). */
export const PARTNER_QUALITIES: Opt[] = [
  { value: "kindness", ru: "Доброта", uz: "Mehribonlik", tr: "İyilik" },
  { value: "honesty", ru: "Честность", uz: "Halollik", tr: "Dürüstlük" },
  { value: "responsibility", ru: "Ответственность", uz: "Masʼuliyat", tr: "Sorumluluk" },
  { value: "intelligence", ru: "Интеллект", uz: "Aql-zakovat", tr: "Zeka" },
  { value: "sense_of_humor", ru: "Чувство юмора", uz: "Hazil tuygʻusi", tr: "Espri anlayışı" },
  { value: "religiosity", ru: "Религиозность", uz: "Diniylik", tr: "Dindarlık" },
  { value: "ambition", ru: "Амбициозность", uz: "Maqsadli", tr: "Hırslılık" },
  { value: "calmness", ru: "Спокойствие", uz: "Bosiqlik", tr: "Sakinlik" },
  { value: "loyalty", ru: "Верность", uz: "Sadoqat", tr: "Sadakat" },
  { value: "family_oriented", ru: "Семейные ценности", uz: "Oilaga sadoqat", tr: "Aile değerleri" },
  { value: "caring", ru: "Заботливость", uz: "Gʻamxoʻrlik", tr: "Şefkatlilik" },
  { value: "independence", ru: "Самостоятельность", uz: "Mustaqillik", tr: "Bağımsızlık" },
  { value: "generosity", ru: "Щедрость", uz: "Saxiylik", tr: "Cömertlik" },
  { value: "patience", ru: "Терпение", uz: "Sabr", tr: "Sabır" },
];

/** Экран 16 — Глобальный режим видимости профиля. Per-block visibility — НЕ в MVP. */
export const PROFILE_VISIBILITY_MODE: Opt[] = [
  { value: "public", ru: "Открытый профиль", uz: "Ochiq profil", tr: "Açık profil" },
  { value: "verified_only", ru: "Только для верифицированных", uz: "Faqat tasdiqlanganlarga", tr: "Yalnızca doğrulanmışlara" },
  { value: "by_request", ru: "По запросу", uz: "Soʻrov boʻyicha", tr: "Talep üzerine" },
];

// ============================================================================
// Anketa V4 (2026-06-30) — спека «Чат 2 — Анкета.md»
// ============================================================================

/** V4 шаг basic — статус-чекбокс «показывать ли район проживания в анкете». */
export const DISTRICT_VISIBLE_DEFAULT = false;

// ---------- Финансы (Чат-2 Экран 9) ----------

/** Стабильность источника дохода. */
export const INCOME_SOURCE_STABILITY: Opt[] = [
  { value: "stable", ru: "Стабильный доход", uz: "Barqaror daromad", tr: "İstikrarlı gelir" },
  { value: "unstable", ru: "Доход непостоянный", uz: "Daromad beqaror", tr: "Düzensiz gelir" },
  { value: "none", ru: "Пока нет дохода", uz: "Hozircha daromad yoʻq", tr: "Henüz gelirim yok" },
];

/** Управление финансами в семье (Чат-2 Экран 9 блок 3). */
export const FAMILY_FINANCE_MANAGEMENT: Opt[] = [
  { value: "joint", ru: "Совместное планирование", uz: "Birgalikda rejalashtirish", tr: "Ortak planlama" },
  { value: "mostly_man", ru: "В основном мужчина", uz: "Asosan erkak", tr: "Ağırlıklı olarak erkek" },
  { value: "mostly_woman", ru: "В основном женщина", uz: "Asosan ayol", tr: "Ağırlıklı olarak kadın" },
  { value: "situational", ru: "Зависит от ситуации", uz: "Vaziyatga qarab", tr: "Duruma göre değişir" },
];

/** Финансовые приоритеты (multi-select до 3). */
export const FINANCIAL_PRIORITIES: Opt[] = [
  { value: "no_debt", ru: "Отсутствие долгов и кредитов", uz: "Qarz va kreditlarsiz hayot", tr: "Borç ve kredi bulunmaması" },
  { value: "savings", ru: "Накопления и финансовая подушка", uz: "Jamgʻarma va moliyaviy yostiq", tr: "Birikim ve acil durum fonu" },
  { value: "investments", ru: "Инвестиции и рост капитала", uz: "Investitsiyalar va kapital oʻsishi", tr: "Yatırım ve sermaye artışı" },
  { value: "budget_planning", ru: "Планирование бюджета", uz: "Byudjetni rejalashtirish", tr: "Bütçe planlaması" },
  { value: "literacy", ru: "Финансовая грамотность", uz: "Moliyaviy savodxonlik", tr: "Finansal okuryazarlık" },
  { value: "generosity", ru: "Щедрость и благотворительность", uz: "Saxiylik va xayriya", tr: "Cömertlik ve hayırseverlik" },
  { value: "housing", ru: "Покупка жилья", uz: "Uy-joy sotib olish", tr: "Konut satın alma" },
  { value: "travel", ru: "Путешествия и впечатления", uz: "Sayohatlar va taassurotlar", tr: "Seyahat ve deneyimler" },
  { value: "independence", ru: "Финансовая независимость", uz: "Moliyaviy mustaqillik", tr: "Finansal bağımsızlık" },
];

/** Примерный ежемесячный доход (UZS) — Optional. Hidden public. */
export const MONTHLY_INCOME_RANGE: Opt[] = [
  { value: "na", ru: "Не хочу указывать", uz: "Koʻrsatmayman", tr: "Belirtmek istemiyorum" },
  { value: "below_5m", ru: "До 5 млн сум", uz: "5 mln soʻmgacha", tr: "5 milyon sum'a kadar" },
  { value: "5_10m", ru: "5–10 млн сум", uz: "5–10 mln soʻm", tr: "5–10 milyon sum" },
  { value: "10_20m", ru: "10–20 млн сум", uz: "10–20 mln soʻm", tr: "10–20 milyon sum" },
  { value: "20_40m", ru: "20–40 млн сум", uz: "20–40 mln soʻm", tr: "20–40 milyon sum" },
  { value: "40m_plus", ru: "40 млн+ сум", uz: "40 mln+ soʻm", tr: "40 milyon+ sum" },
];

/** Финансовые обязательства. Hidden public. */
export const FINANCIAL_OBLIGATIONS: Opt[] = [
  { value: "none", ru: "Нет обязательств", uz: "Majburiyatlar yoʻq", tr: "Yükümlülüğüm yok" },
  { value: "has", ru: "Есть обязательства", uz: "Majburiyatlar bor", tr: "Yükümlülüklerim var" },
  { value: "na", ru: "Предпочту не говорить", uz: "Aytmaslikni afzal koʻraman", tr: "Söylememeyi tercih ederim" },
];

/** Жильё (owner spec §9). Cold в extended.finance, hidden public (без стигмы «нет дома»). */
export const HOUSING_STATUS: Opt[] = [
  { value: "own", ru: "Своё жильё", uz: "Shaxsiy uy-joyim bor", tr: "Kendi evim" },
  { value: "rent", ru: "Аренда", uz: "Ijarada yashayman", tr: "Kira" },
  { value: "with_parents", ru: "С родителями / родственниками", uz: "Ota-onam / qarindoshlarim bilan yashayman", tr: "Ailemle / akrabalarımla" },
  { value: "none", ru: "Пока нет своего жилья", uz: "Hozircha shaxsiy uy-joyim yoʻq", tr: "Henüz kendi evim yok" },
  { value: "na", ru: "Не хочу отвечать", uz: "Javob berishni xohlamayman", tr: "Cevaplamak istemiyorum" },
];

// ---------- Образ жизни и привычки (Чат-2 Экран 10) ----------

/** Ритм / образ жизни. */
export const LIFESTYLE_PACE: Opt[] = [
  { value: "active", ru: "Активный", uz: "Faol", tr: "Aktif" },
  { value: "calm", ru: "Спокойный", uz: "Tinch", tr: "Sakin" },
  { value: "balanced", ru: "Сбалансированный", uz: "Muvozanatli", tr: "Dengeli" },
  { value: "na", ru: "Затрудняюсь ответить", uz: "Javob berishga qiynalaman", tr: "Cevaplamakta zorlanıyorum" },
];

/** Свободное время (multi-select до 3). */
export const FREE_TIME_ACTIVITIES: Opt[] = [
  { value: "sports", ru: "Спорт и тренировки", uz: "Sport va mashqlar", tr: "Spor ve antrenman" },
  { value: "reading", ru: "Чтение книг", uz: "Kitob oʻqish", tr: "Kitap okumak" },
  { value: "travel", ru: "Путешествия", uz: "Sayohatlar", tr: "Seyahat" },
  { value: "family_time", ru: "Время с семьёй", uz: "Oila bilan vaqt", tr: "Ailemle vakit geçirmek" },
  { value: "music", ru: "Музыка", uz: "Musiqa", tr: "Müzik" },
  { value: "art", ru: "Творчество", uz: "Ijod", tr: "Sanat" },
  { value: "volunteering", ru: "Волонтёрство и помощь людям", uz: "Koʻngillilik va yordam", tr: "Gönüllülük ve insanlara yardım" },
  { value: "games", ru: "Игры и развлечения", uz: "Oʻyinlar va dam olish", tr: "Oyunlar ve eğlence" },
  { value: "nature", ru: "Природа и прогулки", uz: "Tabiat va sayrlar", tr: "Doğa ve yürüyüş" },
  { value: "learning", ru: "Обучение и развитие", uz: "Oʻrganish va rivojlanish", tr: "Öğrenme ve gelişim" },
  { value: "spiritual", ru: "Духовные практики", uz: "Maʼnaviy amaliyot", tr: "Manevi uygulamalar" },
  { value: "other", ru: "Другое", uz: "Boshqa", tr: "Diğer" },
];

/** Режим дня. */
export const DAILY_ROUTINE: Opt[] = [
  { value: "early", ru: "Ранний подъём (до 22:30)", uz: "Erta turish (22:30 gacha)", tr: "Erken yatma (22:30'dan önce)" },
  { value: "middle", ru: "Средний режим (22:30–00:00)", uz: "Oʻrtacha (22:30–00:00)", tr: "Orta düzen (22:30–00:00)" },
  { value: "late", ru: "Поздний (после 00:00)", uz: "Kech (00:00 dan keyin)", tr: "Geç (00:00'dan sonra)" },
  { value: "unstable", ru: "Нестабильный режим", uz: "Beqaror", tr: "Düzensiz uyku düzeni" },
];

/** Вредные привычки. Hidden public. */
export const BAD_HABITS_LEVEL: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq", tr: "Yok" },
  { value: "sometimes", ru: "Иногда", uz: "Baʼzan", tr: "Bazen" },
  { value: "quit", ru: "Бывало, но отказался(ась)", uz: "Boʻlgan, lekin tashladim", tr: "Vardı ama bıraktım" },
  { value: "yes", ru: "Есть", uz: "Bor", tr: "Var" },
];

/** Питание. */
export const NUTRITION_STYLE: Opt[] = [
  { value: "balanced", ru: "Сбалансированно", uz: "Muvozanatli", tr: "Dengeli" },
  { value: "regular", ru: "Обычное питание", uz: "Oddiy ovqatlanish", tr: "Normal beslenme" },
  { value: "national", ru: "Предпочитаю национальную кухню", uz: "Milliy taomlarni yoqtiraman", tr: "Yöresel mutfağı tercih ederim" },
  { value: "restricted", ru: "Есть ограничения", uz: "Cheklovlar bor", tr: "Kısıtlamalarım var" },
];

/** Отношение к алкоголю. Hidden public. */
export const ALCOHOL_LEVEL: Opt[] = [
  { value: "no", ru: "Не употребляю", uz: "Iste'mol qilmayman", tr: "Kullanmıyorum" },
  { value: "rare", ru: "Редко, по особым случаям", uz: "Kamdan-kam, alohida holatlarda", tr: "Nadiren, özel günlerde" },
  { value: "sometimes", ru: "Иногда", uz: "Baʼzan", tr: "Bazen" },
  { value: "regular", ru: "Регулярно", uz: "Muntazam", tr: "Düzenli olarak" },
];

/** Наркотические вещества. Hidden public. Чувствительно. */
export const DRUGS_USE: Opt[] = [
  { value: "no", ru: "Нет", uz: "Yoʻq", tr: "Hayır" },
  { value: "past", ru: "Было в прошлом, сейчас нет", uz: "Oʻtmishda boʻlgan, hozir yoʻq", tr: "Geçmişte oldu, şimdi yok" },
  { value: "na", ru: "Предпочитаю не отвечать", uz: "Javob bermaslikni afzal koʻraman", tr: "Cevaplamamayı tercih ederim" },
];

// ---------- Кого ищу: страны партнёра (Чат-2: «не делать жёстким фильтром») ----------

/** Multi-select из существующих CITIZENSHIP. Soft filter, max 3. */
export const PARTNER_PREFERRED_COUNTRIES: Opt[] = CITIZENSHIP;

// ---------- Районы УЗ (cascading per region) ----------
// Реэкспорт из src/lib/profile/uz-districts.ts, где живут ~98 записей
// по 6 крупнейшим регионам (Phase 1). Остальные регионы — freeform fallback.
export { UZ_DISTRICTS_BY_REGION, hasDistrictList } from "./uz-districts";

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);
export const labelOf = (o: Opt[], value: string, locale: string): string => {
  const opt = o.find((x) => x.value === value);
  if (!opt) return value;
  return (locale === "uz" ? opt.uz : locale === "tr" ? opt.tr : opt.ru) || opt.ru;
};

// tr-aware лейбл для любого объекта {ru,uz,tr?} (варианты, города). Fallback → ru,
// поэтому непереведённые tr-строки деградируют в русский, а не в undefined.
export const optLabel = (
  o: { ru: string; uz: string; tr?: string },
  locale: string,
): string => (locale === "uz" ? o.uz : locale === "tr" ? o.tr : o.ru) || o.ru;
