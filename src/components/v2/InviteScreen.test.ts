import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./InviteScreen";

/**
 * Раунд исправлений 1 (Task 9): отказ копирования раньше был тихим -
 * try/catch с пустым catch, человек жал кнопку и ничего не видел.
 * copyToClipboard - чистая функция без React, поэтому обычный .ts-тест в
 * node-окружении (см. vitest.config.ts) - рендер-инфраструктуры для .tsx в
 * проекте нет (ни одного .test.tsx, happy-dom - неиспользуемая
 * devDependency), заводить её ради одной ветки непропорционально.
 *
 * Тест покрывает ТОЛЬКО отображение успех/отказ в "copied"/"failed" -
 * то, что copyFailed дальше рендерит t("copy_error") в InviteScreen,
 * проверено чтением кода, а не тестом (нет component-render harness).
 */
describe("copyToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("отдаёт 'copied', когда navigator.clipboard.writeText успешен", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyToClipboard("https://t.me/baxtlilar_uz_bot?start=7K2MQX")).resolves.toBe(
      "copied",
    );
    expect(writeText).toHaveBeenCalledWith("https://t.me/baxtlilar_uz_bot?start=7K2MQX");
  });

  it("отдаёт 'failed', когда writeText отклоняет промис (нет разрешения)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyToClipboard("https://t.me/baxtlilar_uz_bot?start=7K2MQX")).resolves.toBe(
      "failed",
    );
  });

  it("отдаёт 'failed', когда navigator.clipboard вообще недоступен (старый WebView)", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyToClipboard("https://t.me/baxtlilar_uz_bot?start=7K2MQX")).resolves.toBe(
      "failed",
    );
  });
});
