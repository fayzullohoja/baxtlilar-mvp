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

export const RELIGION_IMPORTANCE: Opt[] = [
  { value: "1", ru: "Не важна", uz: "Muhim emas" },
  { value: "2", ru: "Скорее не важна", uz: "Koʻproq muhim emas" },
  { value: "3", ru: "Умеренно важна", uz: "Oʻrtacha muhim" },
  { value: "4", ru: "Важна", uz: "Muhim" },
  { value: "5", ru: "Очень важна", uz: "Juda muhim" },
];

export const vals = (o: Opt[]): string[] => o.map((x) => x.value);
export const labelOf = (o: Opt[], value: string, locale: string): string =>
  o.find((x) => x.value === value)?.[locale === "uz" ? "uz" : "ru"] ?? value;
