import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Страж дрейфа гейтов на серверных страницах (REQ-1 / CHAT-1).
 *
 * Матрица прав в permissions.ts может быть идеальной, но толку от неё ноль,
 * если СТРАНИЦА её не спрашивает. Именно так возник REQ-1: /requests гейтился
 * только фактом активности (requireActiveUser), поэтому shadow-юзер
 * (lifecycle_state=active + verification_status=needs_changes/rejected) видел
 * входящие заявки и мини-профили отправителей, хотя любое действие по ним
 * API отдавал 403.
 *
 * Тест сканирует ИСХОДНИК страницы и требует, чтобы в нём упоминалось нужное
 * право. Это грубо, но ловит ровно тот класс регресса, который юнит-тесты
 * матрицы прав поймать не могут (матрица была верна — её просто не звали).
 *
 * Паттерн readFileSync-теста в репо: src/i18n/messages-parity.test.ts,
 * src/lib/profile/option-messages.test.ts.
 */

const ROOT = process.cwd();

/**
 * Вырезает комментарии из исходника.
 *
 * КРИТИЧНО для честности теста: без этого закомментированный гейт
 * (`// if (!hasPermission(..., "view_received_interests"))`) всё ещё содержит
 * искомую строку, тест остаётся зелёным и не стережёт НИЧЕГО. Проверено
 * негативным прогоном: со снятым гейтом наивная версия теста проходила.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // блочные
    .replace(/^\s*\/\/.*$/gm, ""); // строчные (в начале строки)
}

/** Страница → право, которое она обязана спрашивать у матрицы. */
const GATED_PAGES: Array<{ page: string; permission: string; note: string }> = [
  {
    page: "src/app/[locale]/requests/page.tsx",
    permission: "view_received_interests",
    note: "REQ-1: иначе shadow видит входящие заявки и мини-профили отправителей",
  },
  {
    page: "src/app/[locale]/v2/chats/page.tsx",
    permission: "open_chat",
    note: "CHAT-1: иначе де-верифицированный видит список чатов с превью сообщений",
  },
  {
    page: "src/app/[locale]/v2/chats/[id]/page.tsx",
    permission: "open_chat",
    note: "CHAT-1: детальная страница чата",
  },
  {
    page: "src/app/[locale]/main/page.tsx",
    permission: "view_feed",
    note: "гейт здесь не редирект, а in-place VerificationPlashka — право всё равно спрашивается",
  },
];

describe("Гейты прав на серверных страницах", () => {
  for (const { page, permission, note } of GATED_PAGES) {
    it(`${page} спрашивает "${permission}" (${note})`, () => {
      const src = stripComments(fs.readFileSync(path.join(ROOT, page), "utf8"));
      expect(
        src.includes(permission),
        `Страница ${page} больше не проверяет право "${permission}". ` +
          `requireActiveUser проверяет только lifecycle_state и НЕ смотрит ` +
          `verification_status — без явного hasPermission(deriveRole(...)) сюда ` +
          `провалится shadow-юзер. Верни гейт или осознанно обнови этот тест.`,
      ).toBe(true);

      // Право должно спрашиваться через матрицу, а не быть строкой в комментарии.
      // Допустимы обе идиомы репо: вложенная (requests, chats) и двухшаговая
      // (main: `const role = deriveRole(...)` → `hasPermission(role, ...)`).
      expect(
        src.includes("deriveRole(") && src.includes("hasPermission("),
        `Страница ${page} упоминает "${permission}", но не вызывает ` +
          `deriveRole(...) + hasPermission(...). Право должно проверяться матрицей, ` +
          `а не подразумеваться.`,
      ).toBe(true);
    });
  }

  it("гейт стоит до первого обращения к БД (supabaseAdmin) — не читаем чужие данные без права", () => {
    const src = stripComments(
      fs.readFileSync(path.join(ROOT, "src/app/[locale]/requests/page.tsx"), "utf8"),
    );
    const gateAt = src.indexOf("view_received_interests");
    const dbAt = src.indexOf("supabaseAdmin()");
    expect(gateAt).toBeGreaterThan(-1);
    expect(dbAt).toBeGreaterThan(-1);
    expect(
      gateAt < dbAt,
      "Гейт view_received_interests должен стоять ДО вызова supabaseAdmin(): " +
        "без права юзер не должен доходить до чтения заявок и мини-профилей (инвариант 1).",
    ).toBe(true);
  });
});

/**
 * ОТКРЫТЫЙ ХВОСТ (намеренно не покрыт ассертом, чтобы тест не был красным):
 * src/app/[locale]/v2/profile/[id]/page.tsx гейтит ЦЕЛЬ (активна, опубликована,
 * не заблокирована), но не спрашивает право СМОТРЯЩЕГО. Право "view_feed"
 * задокументировано как «видеть чужие профили», и shadow его явно лишён
 * (permissions.ts). Досягаемость низкая (в ленту shadow не попадает, UUID не
 * перебрать), поэтому это follow-up, а не часть REQ-1.
 */
