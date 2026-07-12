// V4 (2026-06-30) — Чат 2 — Анкета.md · Экран 2 «Текущее проживание».
//
// Фазированное покрытие районов Узбекистана. Phase 1: 6 крупнейших регионов
// (Ташкент город + Ташкентская обл. + Самарканд + Бухара + Фергана +
// Андижан). Остальные 8 регионов — freeform TextInput fallback в форме.
// Phase 2 (v4.1): расширить на Наманган, Хорезм, Каракалпакстан и т.д.
//
// Источник: Wikipedia + State Committee on Statistics of UZ.
// Значения (value) — snake_case ASCII (стабильные ключи, не меняются при
// переименовании UI-лейблов).

import type { Opt } from "./options";

export const UZ_DISTRICTS_BY_REGION: Record<string, Opt[]> = {
  // г. Ташкент (Toshkent sh.) — 12 районов/городов
  tashkent_city: [
    { value: "bektemir", ru: "Бектемирский район", uz: "Bektemir" },
    { value: "chilonzor", ru: "Чиланзарский район", uz: "Chilonzor" },
    { value: "mirobod", ru: "Мирабадский район", uz: "Mirobod" },
    { value: "mirzo_ulugbek", ru: "Мирзо-Улугбекский район", uz: "Mirzo Ulugʻbek" },
    { value: "sergeli", ru: "Сергелийский район", uz: "Sergeli" },
    { value: "shayxontohur", ru: "Шайхантахурский район", uz: "Shayxontohur" },
    { value: "uchtepa", ru: "Учтепинский район", uz: "Uchtepa" },
    { value: "olmazor", ru: "Алмазарский район", uz: "Olmazor" },
    { value: "yakkasaroy", ru: "Яккасарайский район", uz: "Yakkasaroy" },
    { value: "yashnobod", ru: "Яшнабадский район", uz: "Yashnobod" },
    { value: "yunusobod", ru: "Юнусабадский район", uz: "Yunusobod" },
    { value: "yangihayot", ru: "Янгихаётский район", uz: "Yangihayot" },
  ],
  // Ташкентская область (Toshkent vil.) — 22 районов/городов
  tashkent_region: [
    { value: "bekobod", ru: "Бекабадский район", uz: "Bekobod t." },
    { value: "boka", ru: "Букинский район", uz: "Boʻka t." },
    { value: "bostonliq", ru: "Бостанлыкский район", uz: "Boʻstonliq t." },
    { value: "chinoz", ru: "Чиназский район", uz: "Chinoz t." },
    { value: "qibray", ru: "Кибрайский район", uz: "Qibray t." },
    { value: "ohangaron", ru: "Ахангаранский район", uz: "Ohangaron t." },
    { value: "oqqorgon", ru: "Аккурганский район", uz: "Oqqoʻrgʻon t." },
    { value: "parkent", ru: "Паркентский район", uz: "Parkent t." },
    { value: "piskent", ru: "Пскентский район", uz: "Piskent t." },
    { value: "quyichirchiq", ru: "Куйичирчикский район", uz: "Quyichirchiq t." },
    { value: "ortachirchiq", ru: "Уртачирчикский район", uz: "Oʻrtachirchiq t." },
    { value: "yuqorichirchiq", ru: "Юкарычирчикский район", uz: "Yuqorichirchiq t." },
    { value: "yangiyol", ru: "Янгиюльский район", uz: "Yangiyoʻl t." },
    { value: "zangiota", ru: "Зангиатинский район", uz: "Zangiota t." },
    { value: "toshkent_tuman", ru: "Ташкентский район", uz: "Toshkent t." },
    { value: "olmaliq_shahar", ru: "г. Алмалык", uz: "Olmaliq sh." },
    { value: "angren_shahar", ru: "г. Ангрен", uz: "Angren sh." },
    { value: "bekobod_shahar", ru: "г. Бекабад", uz: "Bekobod sh." },
    { value: "chirchiq_shahar", ru: "г. Чирчик", uz: "Chirchiq sh." },
    { value: "nurafshon_shahar", ru: "г. Нурафшан", uz: "Nurafshon sh." },
    { value: "ohangaron_shahar", ru: "г. Ахангаран", uz: "Ohangaron sh." },
    { value: "yangiyol_shahar", ru: "г. Янгиюль", uz: "Yangiyoʻl sh." },
  ],
  // Самаркандская область (Samarqand vil.) — 16 районов/городов
  samarkand: [
    { value: "bulungur", ru: "Булунгурский район", uz: "Bulungʻur t." },
    { value: "ishtixon", ru: "Иштыханский район", uz: "Ishtixon t." },
    { value: "jomboy", ru: "Джамбайский район", uz: "Jomboy t." },
    { value: "kattaqorgon", ru: "Каттакурганский район", uz: "Kattaqoʻrgʻon t." },
    { value: "narpay", ru: "Нарпайский район", uz: "Narpay t." },
    { value: "nurobod", ru: "Нурабадский район", uz: "Nurobod t." },
    { value: "oqdaryo", ru: "Акдарьинский район", uz: "Oqdaryo t." },
    { value: "paxtachi", ru: "Пахтачийский район", uz: "Paxtachi t." },
    { value: "pastdargom", ru: "Пастдаргомский район", uz: "Past Dargʻom t." },
    { value: "payariq", ru: "Пайарыкский район", uz: "Payariq t." },
    { value: "qoshrabot", ru: "Кошрабадский район", uz: "Qoʻshrabot t." },
    { value: "samarqand_tuman", ru: "Самаркандский район", uz: "Samarqand t." },
    { value: "tayloq", ru: "Тайлакский район", uz: "Tayloq t." },
    { value: "urgut", ru: "Ургутский район", uz: "Urgut t." },
    { value: "samarqand_shahar", ru: "г. Самарканд", uz: "Samarqand sh." },
    { value: "kattaqorgon_shahar", ru: "г. Каттакурган", uz: "Kattaqoʻrgʻon sh." },
  ],
  // Бухарская область (Buxoro vil.) — 13 районов/городов
  bukhara: [
    { value: "olot", ru: "Алатский район", uz: "Olot t." },
    { value: "buxoro_tuman", ru: "Бухарский район", uz: "Buxoro t." },
    { value: "gijduvon", ru: "Гиждуванский район", uz: "Gʻijduvon t." },
    { value: "jondor", ru: "Жондорский район", uz: "Jondor t." },
    { value: "kogon_tuman", ru: "Каганский район", uz: "Kogon t." },
    { value: "qorakol", ru: "Каракульский район", uz: "Qorakoʻl t." },
    { value: "qorovulbozor", ru: "Караулбазарский район", uz: "Qorovulbozor t." },
    { value: "peshku", ru: "Пешкунский район", uz: "Peshku t." },
    { value: "romitan", ru: "Ромитанский район", uz: "Romitan t." },
    { value: "shofirkon", ru: "Шафирканский район", uz: "Shofirkon t." },
    { value: "vobkent", ru: "Вабкентский район", uz: "Vobkent t." },
    { value: "buxoro_shahar", ru: "г. Бухара", uz: "Buxoro sh." },
    { value: "kogon_shahar", ru: "г. Каган", uz: "Kogon sh." },
  ],
  // Ферганская область (Fargʻona vil.) — 19 районов/городов
  fergana: [
    { value: "oltiariq", ru: "Алтыарыкский район", uz: "Oltiariq t." },
    { value: "bogdod", ru: "Багдадский район", uz: "Bogʻdod t." },
    { value: "beshariq", ru: "Бешарыкский район", uz: "Beshariq t." },
    { value: "buvayda", ru: "Бувайдинский район", uz: "Buvayda t." },
    { value: "dangara", ru: "Дангаринский район", uz: "Dangʻara t." },
    { value: "fargona_tuman", ru: "Ферганский район", uz: "Fargʻona t." },
    { value: "furqat", ru: "Фуркатский район", uz: "Furqat t." },
    { value: "qoshtepa", ru: "Куштепинский район", uz: "Qoʻshtepa t." },
    { value: "quva", ru: "Кувинский район", uz: "Quva t." },
    { value: "rishton", ru: "Риштанский район", uz: "Rishton t." },
    { value: "sox", ru: "Сохский район", uz: "Soʻx t." },
    { value: "toshloq", ru: "Ташлакский район", uz: "Toshloq t." },
    { value: "uchkoprik", ru: "Учкуприкский район", uz: "Uchkoʻprik t." },
    { value: "ozbekiston", ru: "Узбекистанский район", uz: "Oʻzbekiston t." },
    { value: "yozyovon", ru: "Язъяванский район", uz: "Yozyovon t." },
    { value: "fargona_shahar", ru: "г. Фергана", uz: "Fargʻona sh." },
    { value: "margilon_shahar", ru: "г. Маргилан", uz: "Margʻilon sh." },
    { value: "qoqon_shahar", ru: "г. Коканд", uz: "Qoʻqon sh." },
    { value: "quvasoy_shahar", ru: "г. Кувасай", uz: "Quvasoy sh." },
  ],
  // Андижанская область (Andijon vil.) — 16 районов/городов
  andijan: [
    { value: "andijon_tuman", ru: "Андижанский район", uz: "Andijon t." },
    { value: "asaka", ru: "Асакинский район", uz: "Asaka t." },
    { value: "baliqchi", ru: "Балыкчинский район", uz: "Baliqchi t." },
    { value: "boz", ru: "Бузский район", uz: "Boʻz t." },
    { value: "buloqboshi", ru: "Булакбашинский район", uz: "Buloqboshi t." },
    { value: "izboskan", ru: "Избасканский район", uz: "Izboskan t." },
    { value: "jalaquduq", ru: "Джалакудукский район", uz: "Jalaquduq t." },
    { value: "xojaobod", ru: "Ходжаабадский район", uz: "Xoʻjaobod t." },
    { value: "marhamat", ru: "Мархаматский район", uz: "Marhamat t." },
    { value: "oltinkol", ru: "Алтынкульский район", uz: "Oltinkoʻl t." },
    { value: "paxtaobod", ru: "Пахтаабадский район", uz: "Paxtaobod t." },
    { value: "qorgontepa", ru: "Кургантепинский район", uz: "Qoʻrgʻontepa t." },
    { value: "shahrixon", ru: "Шахриханский район", uz: "Shahrixon t." },
    { value: "ulugnor", ru: "Улугнорский район", uz: "Ulugʻnor t." },
    { value: "andijon_shahar", ru: "г. Андижан", uz: "Andijon sh." },
    { value: "xonobod_shahar", ru: "г. Ханабад", uz: "Xonobod sh." },
  ],
};

/** True если для региона есть курируемый список районов. */
export function hasDistrictList(region: string): boolean {
  return region in UZ_DISTRICTS_BY_REGION;
}

// Плоская карта код-района → Opt (по всем регионам) — для показа названия
// вместо кода (напр. в admin ProfileTab).
const DISTRICT_BY_VALUE: Record<string, Opt> = Object.fromEntries(
  Object.values(UZ_DISTRICTS_BY_REGION)
    .flat()
    .map((d) => [d.value, d]),
);

/** Локализованное название района по коду; freeform/неизвестное — как есть. */
export function districtLabel(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  const d = DISTRICT_BY_VALUE[value];
  if (!d) return value; // freeform-ввод или старое/неизвестное значение
  return locale === "uz" ? d.uz : d.ru;
}
