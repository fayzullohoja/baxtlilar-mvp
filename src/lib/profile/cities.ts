// Канонический справочник городов Узбекистана для анкеты (точные данные → чистый матчинг).
// Сгруппировано по регионам (14): город Ташкент + 12 областей + Республика Каракалпакстан.
// value — стабильный latin-слаг (хранится в БД), ru/uz — локализованные подписи.

export type CityOpt = { value: string; ru: string; uz: string };
export type CityGroup = { region: { ru: string; uz: string }; cities: CityOpt[] };

export const CITY_GROUPS: CityGroup[] = [
  {
    region: { ru: "Город Ташкент", uz: "Toshkent shahri" },
    cities: [{ value: "toshkent", ru: "Ташкент", uz: "Toshkent" }],
  },
  {
    region: { ru: "Ташкентская область", uz: "Toshkent viloyati" },
    cities: [
      { value: "nurafshon", ru: "Нурафшон", uz: "Nurafshon" },
      { value: "angren", ru: "Ангрен", uz: "Angren" },
      { value: "olmaliq", ru: "Алмалык", uz: "Olmaliq" },
      { value: "bekobod", ru: "Бекабад", uz: "Bekobod" },
      { value: "chirchiq", ru: "Чирчик", uz: "Chirchiq" },
      { value: "yangiyol", ru: "Янгиюль", uz: "Yangiyoʻl" },
      { value: "ohangaron", ru: "Ахангаран", uz: "Ohangaron" },
      { value: "gazalkent", ru: "Газалкент", uz: "Gʻazalkent" },
      { value: "parkent", ru: "Паркент", uz: "Parkent" },
      { value: "boka", ru: "Бука", uz: "Boʻka" },
      { value: "pskent", ru: "Пскент", uz: "Pskent" },
      { value: "chinoz", ru: "Чиназ", uz: "Chinoz" },
      { value: "keles", ru: "Келес", uz: "Keles" },
      { value: "yangiobod", ru: "Янгиабад", uz: "Yangiobod" },
    ],
  },
  {
    region: { ru: "Республика Каракалпакстан", uz: "Qoraqalpogʻiston Respublikasi" },
    cities: [
      { value: "nukus", ru: "Нукус", uz: "Nukus" },
      { value: "beruniy", ru: "Беруни", uz: "Beruniy" },
      { value: "chimboy", ru: "Чимбай", uz: "Chimboy" },
      { value: "xojayli", ru: "Ходжейли", uz: "Xoʻjayli" },
      { value: "qongirot", ru: "Кунград", uz: "Qoʻngʻirot" },
      { value: "mangit", ru: "Манги", uz: "Mangʻit" },
      { value: "taxiatosh", ru: "Тахиаташ", uz: "Taxiatosh" },
      { value: "tortkol", ru: "Турткуль", uz: "Toʻrtkoʻl" },
      { value: "qanlikol", ru: "Канлыкуль", uz: "Qanlikoʻl" },
      { value: "shumanay", ru: "Шуманай", uz: "Shumanay" },
    ],
  },
  {
    region: { ru: "Андижанская область", uz: "Andijon viloyati" },
    cities: [
      { value: "andijon", ru: "Андижан", uz: "Andijon" },
      { value: "asaka", ru: "Асака", uz: "Asaka" },
      { value: "xonobod", ru: "Ханабад", uz: "Xonobod" },
      { value: "shahrixon", ru: "Шахрихан", uz: "Shahrixon" },
      { value: "qorgontepa", ru: "Кургантепа", uz: "Qoʻrgʻontepa" },
      { value: "marhamat", ru: "Мархамат", uz: "Marhamat" },
      { value: "paytug", ru: "Пайтуг", uz: "Paytugʻ" },
      { value: "xojaobod", ru: "Ходжаабад", uz: "Xoʻjaobod" },
      { value: "boz", ru: "Боз", uz: "Boʻz" },
    ],
  },
  {
    region: { ru: "Бухарская область", uz: "Buxoro viloyati" },
    cities: [
      { value: "buxoro", ru: "Бухара", uz: "Buxoro" },
      { value: "kogon", ru: "Каган", uz: "Kogon" },
      { value: "gijduvon", ru: "Гиждуван", uz: "Gʻijduvon" },
      { value: "vobkent", ru: "Вабкент", uz: "Vobkent" },
      { value: "galaosiyo", ru: "Галаасия", uz: "Galaosiyo" },
      { value: "romitan", ru: "Ромитан", uz: "Romitan" },
      { value: "shofirkon", ru: "Шафиркан", uz: "Shofirkon" },
      { value: "qorakol", ru: "Каракуль", uz: "Qorakoʻl" },
      { value: "olot", ru: "Алат", uz: "Olot" },
    ],
  },
  {
    region: { ru: "Джизакская область", uz: "Jizzax viloyati" },
    cities: [
      { value: "jizzax", ru: "Джизак", uz: "Jizzax" },
      { value: "sharofrashidov", ru: "Шараф Рашидов (Гагарин)", uz: "Sharof Rashidov" },
      { value: "dostlik", ru: "Дустлик", uz: "Doʻstlik" },
      { value: "gallaorol", ru: "Галляарал", uz: "Gʻallaorol" },
      { value: "paxtakor", ru: "Пахтакор", uz: "Paxtakor" },
      { value: "zomin", ru: "Заамин", uz: "Zomin" },
      { value: "zafarobod", ru: "Зафарабад", uz: "Zafarobod" },
    ],
  },
  {
    region: { ru: "Кашкадарьинская область", uz: "Qashqadaryo viloyati" },
    cities: [
      { value: "qarshi", ru: "Карши", uz: "Qarshi" },
      { value: "shahrisabz", ru: "Шахрисабз", uz: "Shahrisabz" },
      { value: "kitob", ru: "Китаб", uz: "Kitob" },
      { value: "guzor", ru: "Гузар", uz: "Gʻuzor" },
      { value: "koson", ru: "Касан", uz: "Koson" },
      { value: "muborak", ru: "Мубарек", uz: "Muborak" },
      { value: "kasbi", ru: "Касби", uz: "Kasbi" },
      { value: "chiroqchi", ru: "Чиракчи", uz: "Chiroqchi" },
      { value: "dehqonobod", ru: "Дехканабад", uz: "Dehqonobod" },
      { value: "yakkabog", ru: "Яккабаг", uz: "Yakkabogʻ" },
    ],
  },
  {
    region: { ru: "Навоийская область", uz: "Navoiy viloyati" },
    cities: [
      { value: "navoiy", ru: "Навои", uz: "Navoiy" },
      { value: "zarafshon", ru: "Зарафшан", uz: "Zarafshon" },
      { value: "uchquduq", ru: "Учкудук", uz: "Uchquduq" },
      { value: "nurota", ru: "Нурата", uz: "Nurota" },
      { value: "karmana", ru: "Кармана", uz: "Karmana" },
      { value: "qiziltepa", ru: "Кызылтепа", uz: "Qiziltepa" },
      { value: "konimex", ru: "Канимех", uz: "Konimex" },
    ],
  },
  {
    region: { ru: "Наманганская область", uz: "Namangan viloyati" },
    cities: [
      { value: "namangan", ru: "Наманган", uz: "Namangan" },
      { value: "chust", ru: "Чует", uz: "Chust" },
      { value: "kosonsoy", ru: "Касансай", uz: "Kosonsoy" },
      { value: "pop", ru: "Пап", uz: "Pop" },
      { value: "chortoq", ru: "Чартак", uz: "Chortoq" },
      { value: "uchqorgon", ru: "Учкурган", uz: "Uchqoʻrgʻon" },
      { value: "toraqorgon", ru: "Туракурган", uz: "Toʻraqoʻrgʻon" },
      { value: "haqqulobod", ru: "Хаккулабад", uz: "Haqqulobod" },
      { value: "yangiqorgon", ru: "Янгикурган", uz: "Yangiqoʻrgʻon" },
    ],
  },
  {
    region: { ru: "Самаркандская область", uz: "Samarqand viloyati" },
    cities: [
      { value: "samarqand", ru: "Самарканд", uz: "Samarqand" },
      { value: "kattaqorgon", ru: "Каттакурган", uz: "Kattaqoʻrgʻon" },
      { value: "urgut", ru: "Ургут", uz: "Urgut" },
      { value: "bulungor", ru: "Булунгур", uz: "Bulungʻur" },
      { value: "jomboy", ru: "Джамбай", uz: "Jomboy" },
      { value: "ishtixon", ru: "Иштыхан", uz: "Ishtixon" },
      { value: "oqtosh", ru: "Акташ", uz: "Oqtosh" },
      { value: "payariq", ru: "Пайарык", uz: "Payariq" },
      { value: "nurobod", ru: "Нурабад", uz: "Nurobod" },
      { value: "chelak", ru: "Челек", uz: "Chelak" },
    ],
  },
  {
    region: { ru: "Сурхандарьинская область", uz: "Surxondaryo viloyati" },
    cities: [
      { value: "termiz", ru: "Термез", uz: "Termiz" },
      { value: "denov", ru: "Денау", uz: "Denov" },
      { value: "sherobod", ru: "Шерабад", uz: "Sherobod" },
      { value: "shorchi", ru: "Шурчи", uz: "Shoʻrchi" },
      { value: "boysun", ru: "Байсун", uz: "Boysun" },
      { value: "qumqorgon", ru: "Кумкурган", uz: "Qumqoʻrgʻon" },
      { value: "jarqorgon", ru: "Джаркурган", uz: "Jarqoʻrgʻon" },
      { value: "sariosiyo", ru: "Сариасия", uz: "Sariosiyo" },
      { value: "angor", ru: "Ангор", uz: "Angor" },
    ],
  },
  {
    region: { ru: "Сырдарьинская область", uz: "Sirdaryo viloyati" },
    cities: [
      { value: "guliston", ru: "Гулистан", uz: "Guliston" },
      { value: "yangiyer", ru: "Янгиер", uz: "Yangiyer" },
      { value: "shirin", ru: "Ширин", uz: "Shirin" },
      { value: "sirdaryo", ru: "Сырдарья", uz: "Sirdaryo" },
      { value: "boyovut", ru: "Баяут", uz: "Boyovut" },
      { value: "sayxun", ru: "Сайхун", uz: "Sayxun" },
      { value: "xovos", ru: "Хаваст", uz: "Xovos" },
      { value: "oqoltin", ru: "Акалтын", uz: "Oqoltin" },
    ],
  },
  {
    region: { ru: "Ферганская область", uz: "Fargʻona viloyati" },
    cities: [
      { value: "fargona", ru: "Фергана", uz: "Fargʻona" },
      { value: "margilon", ru: "Маргилан", uz: "Margʻilon" },
      { value: "qoqon", ru: "Коканд", uz: "Qoʻqon" },
      { value: "quvasoy", ru: "Кувасай", uz: "Quvasoy" },
      { value: "quva", ru: "Кува", uz: "Quva" },
      { value: "rishton", ru: "Риштан", uz: "Rishton" },
      { value: "beshariq", ru: "Бешарык", uz: "Beshariq" },
      { value: "yaypan", ru: "Яйпан", uz: "Yaypan" },
      { value: "oltiariq", ru: "Алтыарык", uz: "Oltiariq" },
      { value: "qoshtepa", ru: "Куштепа", uz: "Qoʻshtepa" },
    ],
  },
  {
    region: { ru: "Хорезмская область", uz: "Xorazm viloyati" },
    cities: [
      { value: "urganch", ru: "Ургенч", uz: "Urganch" },
      { value: "xiva", ru: "Хива", uz: "Xiva" },
      { value: "hazorasp", ru: "Хазарасп", uz: "Hazorasp" },
      { value: "shovot", ru: "Шават", uz: "Shovot" },
      { value: "gurlan", ru: "Гурлен", uz: "Gurlan" },
      { value: "bogot", ru: "Багат (Питняк)", uz: "Bogʻot" },
      { value: "yangiariq", ru: "Янгиарык", uz: "Yangiariq" },
      { value: "qoshkopir", ru: "Кошкупыр", uz: "Qoʻshkoʻpir" },
    ],
  },
];

/** Плоский список всех валидных значений города (для валидации). */
export const ALL_CITY_VALUES: string[] = CITY_GROUPS.flatMap((g) => g.cities.map((c) => c.value));

const CITY_BY_VALUE: Record<string, CityOpt> = Object.fromEntries(
  CITY_GROUPS.flatMap((g) => g.cities).map((c) => [c.value, c]),
);

/** Локализованная подпись города по сохранённому значению. */
export const cityLabel = (value: string | null | undefined, locale: string): string => {
  if (!value) return "";
  const c = CITY_BY_VALUE[value];
  if (!c) return value; // на случай старых/неизвестных значений
  return locale === "uz" ? c.uz : c.ru;
};

const REGION_BY_CITY: Record<string, { ru: string; uz: string }> = Object.fromEntries(
  CITY_GROUPS.flatMap((g) => g.cities.map((c) => [c.value, g.region])),
);

/** Регион (область) по значению города — для демографии. Для старых/неизвестных значений вернёт «Другое». */
export const regionLabelOfCity = (value: string | null | undefined, locale: string): string => {
  if (!value) return "";
  const r = REGION_BY_CITY[value];
  if (!r) return locale === "uz" ? "Boshqa" : "Другое";
  return locale === "uz" ? r.uz : r.ru;
};
