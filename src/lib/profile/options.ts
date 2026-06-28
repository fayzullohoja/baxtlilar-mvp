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

/** @deprecated 2026-06-28 — заменено на RELIGION_PRACTICE + RELIGION_PARTNER_MATCH.
 *  Шкала 1-5 создавала ложное «вера может быть неважна» для UZ-платформы серьёзных
 *  знакомств. Оставлено как источник для legacy данных. */
export const RELIGION_IMPORTANCE: Opt[] = [
  { value: "1", ru: "Не важна", uz: "Muhim emas" },
  { value: "2", ru: "Скорее не важна", uz: "Koʻproq muhim emas" },
  { value: "3", ru: "Умеренно важна", uz: "Oʻrtacha muhim" },
  { value: "4", ru: "Важна", uz: "Muhim" },
  { value: "5", ru: "Очень важна", uz: "Juda muhim" },
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

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);
export const labelOf = (o: Opt[], value: string, locale: string): string =>
  o.find((x) => x.value === value)?.[locale === "uz" ? "uz" : "ru"] ?? value;
