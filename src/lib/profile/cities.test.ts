import { describe, it, expect } from "vitest";
import {
  CITIES_BY_REGION,
  citiesForRegion,
  hasCityList,
  CITY_GROUPS,
} from "./cities";
import { UZ_REGIONS, vals } from "./options";

describe("cities — region-code → города (Экран 2, зависимый дропдаун)", () => {
  it("каждый регион из UZ_REGIONS имеет города (label→code mapping без опечаток)", () => {
    // Если кто-то переименует region.ru в CITY_GROUPS и забудет обновить
    // REGION_LABEL_TO_CODE — этот тест поймает пропавший регион.
    for (const region of vals(UZ_REGIONS)) {
      expect(
        hasCityList(region),
        `нет городов для региона ${region}`,
      ).toBe(true);
    }
  });

  it("CITIES_BY_REGION покрывает все 14 групп CITY_GROUPS", () => {
    expect(Object.keys(CITIES_BY_REGION)).toHaveLength(CITY_GROUPS.length);
  });

  it("citiesForRegion возвращает города для известного региона", () => {
    const list = citiesForRegion("tashkent_city");
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("value");
    expect(list[0]).toHaveProperty("ru");
  });

  it("citiesForRegion пусто для неизвестного региона", () => {
    expect(citiesForRegion("atlantis")).toEqual([]);
    expect(hasCityList("atlantis")).toBe(false);
  });
});
