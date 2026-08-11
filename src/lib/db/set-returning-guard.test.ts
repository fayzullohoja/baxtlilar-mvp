import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SET_RETURNING } from "./query-builder";

// Root-cause гейт для класса бага C-026/C-032: функция БД `returns table/setof`,
// вызванная через .rpc, ДОЛЖНА быть в SET_RETURNING — иначе query-builder зовёт её
// скаляром (`SELECT f() AS v`), node-pg отдаёт composite СТРОКОЙ, и роут не может
// прочитать поля (accept_interest всегда возвращал 409). Этот тест поймал бы это
// на CI, а не в проде: связка роут→query-builder→RPC не покрыта интеграционно.

const MIG_DIR = join(process.cwd(), "supabase", "migrations");
const SRC_DIR = join(process.cwd(), "src");

/** name → set-returning? По последнему определению (сортировка по имени файла). */
function setReturningFromMigrations(): Map<string, boolean> {
  const map = new Map<string, boolean>();
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  // Схема в объявлении необязательна и на имя функции не влияет, но парсер её
  // не знал - и любое `create function public.foo(` проходило мимо гейта
  // целиком. Гейт, слепой к части определений, ловит половину баг-класса.
  const defRe = /create\s+(?:or\s+replace\s+)?function\s+(?:\w+\.)?(\w+)\s*\(/gi;
  for (const f of files) {
    const sql = readFileSync(join(MIG_DIR, f), "utf8");
    let m: RegExpExecArray | null;
    defRe.lastIndex = 0;
    while ((m = defRe.exec(sql))) {
      const name = m[1];
      // сигнатура+returns до тела функции ($$-разделитель)
      const bodyStart = sql.indexOf("$$", m.index);
      const head = sql.slice(m.index, bodyStart === -1 ? m.index + 800 : bodyStart);
      const isSet = /returns\s+(table|setof)\b/i.test(head);
      map.set(name, isSet); // последнее определение выигрывает
    }
  }
  return map;
}

/** Все имена функций, вызванных через .rpc("name") в src. */
function rpcCallsInSrc(): Set<string> {
  const names = new Set<string>();
  const rpcRe = /\.rpc\(\s*["'`](\w+)["'`]/g;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = readFileSync(p, "utf8");
        let m: RegExpExecArray | null;
        rpcRe.lastIndex = 0;
        while ((m = rpcRe.exec(src))) names.add(m[1]);
      }
    }
  };
  walk(SRC_DIR);
  return names;
}

describe("SET_RETURNING guard — набор RPC совпадает с returns table/setof", () => {
  const setReturning = setReturningFromMigrations();

  it("парсер миграций находит известные set-функции", () => {
    // sanity: если парсер сломан, остальные проверки бессмысленны
    expect(setReturning.get("process_interest")).toBe(true);
    expect(setReturning.get("get_recommendations")).toBe(true);
    expect(setReturning.get("accept_interest")).toBe(true);
    expect(setReturning.get("enqueue_tg_outbox")).toBe(false); // returns uuid (скаляр)
    // create_feedback объявлялась схемо-квалифицированно (public.create_feedback)
    // и потому была НЕВИДИМА гейту: парсер не находил её вовсе, а проверка
    // «вызванная set-функция зарегистрирована» молча пропускает то, чего нет в
    // карте. Гейт, слепой к части функций, ловит не баг-класс, а его половину.
    expect(setReturning.get("create_feedback")).toBe(true);
  });

  it("каждая ВЫЗВАННАЯ .rpc set-функция зарегистрирована в SET_RETURNING", () => {
    const missing: string[] = [];
    for (const name of rpcCallsInSrc()) {
      if (setReturning.get(name) === true && !SET_RETURNING.has(name)) missing.push(name);
    }
    // Именно это упустил C-026: accept_interest вызывался, был set-returning, но не в SET_RETURNING.
    expect(missing, `set-returning RPC не в SET_RETURNING (→ читаются скаляром/строкой): ${missing.join(", ")}`).toEqual([]);
  });

  it("нет устаревших/опечатанных записей в SET_RETURNING", () => {
    const stale: string[] = [];
    for (const name of SET_RETURNING) {
      // запись должна соответствовать реальной set-returning функции миграций
      if (setReturning.get(name) !== true) stale.push(name);
    }
    expect(stale, `в SET_RETURNING есть имена, которые не являются set-returning функциями: ${stale.join(", ")}`).toEqual([]);
  });
});
