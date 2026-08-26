import { describe, it, expect } from "vitest";
import { LIFE_VALUES_MAX, FREE_TIME_MAX, BIO_MIN, BIO_MAX } from "./limits";
import { valuesV3Schema, lifestyleSchema, selfSchema } from "./schemas";
import { EDIT_FIELD_BY_KEY } from "@/lib/admin/profile-edit-schema";

/**
 * Предел живёт в limits.ts, а схема, форма и админка на него ссылаются.
 * Здесь проверяется, что ссылка не подменена числом обратно: именно так эти
 * правила и разъезжались - предел поднимали в одном месте из четырёх.
 */

const findField = (key: string) => EDIT_FIELD_BY_KEY[key];

describe("пределы полей не разъехались между сервером и админкой", () => {
  it("ценности: схема и админка берут один предел", () => {
    const tooMany = Array.from({ length: LIFE_VALUES_MAX + 1 }, () => "family");
    expect(valuesV3Schema.safeParse({ religion: "islam", top_life_values: tooMany }).success).toBe(false);
    expect(findField("top_life_values")?.maxItems).toBe(LIFE_VALUES_MAX);
  });

  it("досуг: схема и админка берут один предел", () => {
    expect(findField("free_time_activities")?.maxItems).toBe(FREE_TIME_MAX);
  });

  it("текст о себе: админка не разрешает больше, чем примет сервер", () => {
    // Раньше админка разрешала 1000 при серверных 500 - оператор набирал текст,
    // который потом отвергался.
    expect(findField("bio")?.maxLen).toBe(BIO_MAX);
    const tooLong = "я".repeat(BIO_MAX + 1);
    const r = selfSchema.safeParse({
      bio: tooLong, education: "higher", activity_field: "it_software", employment_status: "working",
    });
    expect(r.success).toBe(false);
  });

  it("слишком короткий текст о себе тоже отбивается", () => {
    const r = selfSchema.safeParse({
      bio: "я".repeat(BIO_MIN - 1), education: "higher", activity_field: "it_software", employment_status: "working",
    });
    expect(r.success).toBe(false);
  });

  it("схема досуга принимает ровно столько, сколько обещает предел", () => {
    const ok = Array.from({ length: FREE_TIME_MAX }, (_, i) => ["sports", "reading", "travel", "family_time", "music"][i]);
    const r = lifestyleSchema.safeParse({
      lifestyle_pace: "balanced", free_time_activities: ok, daily_routine: "middle",
    });
    expect(r.success, JSON.stringify(r.success ? {} : r.error.issues[0])).toBe(true);
  });
});
