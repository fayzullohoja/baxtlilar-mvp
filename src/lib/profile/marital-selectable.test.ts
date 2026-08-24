import { describe, it, expect } from "vitest";
import { MARITAL_STATUS, MARITAL_STATUS_SELECTABLE } from "./options";
import { familySchema } from "./schemas";

/**
 * Замечание 6 тестеров family launch: вариант «Другое» в семейном положении
 * ничего не сообщал о человеке, но продолжал тянуть за собой вопросы о детях
 * и сроках брака. Вариант убран из выбора в анкете.
 *
 * Ключевое требование, которое этот тест и держит: убран ТОЛЬКО из выбора.
 * У части людей 'other' уже записан, и проверка обязана продолжать его
 * принимать - иначе им сломается сохранение анкеты, а модератор перестанет
 * видеть их настоящий статус.
 */
describe("семейное положение: «Другое» убрано из выбора, но не из данных", () => {
  it("в анкете этого варианта больше нет", () => {
    expect(MARITAL_STATUS_SELECTABLE.map((o) => o.value)).not.toContain("other");
  });

  it("остальные варианты на месте и в том же порядке", () => {
    expect(MARITAL_STATUS_SELECTABLE.map((o) => o.value)).toEqual(
      MARITAL_STATUS.filter((o) => o.value !== "other").map((o) => o.value),
    );
    expect(MARITAL_STATUS_SELECTABLE.length).toBe(MARITAL_STATUS.length - 1);
  });

  it("уже записанное 'other' по-прежнему проходит проверку", () => {
    // Тот, у кого статус проставлен раньше, обязан сохранять анкету дальше.
    const base = {
      marital_status: "other",
      has_children: false,
      future_children_plan: "want",
    };
    const res = familySchema.safeParse(base);
    const rejectedByMarital =
      !res.success &&
      res.error.issues.some((i) => i.path.includes("marital_status"));
    expect(
      rejectedByMarital,
      "значение 'other' отвергается проверкой - у существующих людей сломается сохранение",
    ).toBe(false);
  });

  it("админка по-прежнему знает полный список", () => {
    expect(MARITAL_STATUS.map((o) => o.value)).toContain("other");
  });
});
