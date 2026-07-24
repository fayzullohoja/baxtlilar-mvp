import "server-only";

/**
 * Минимальный query-builder поверх node-postgres, повторяющий ТО подмножество
 * поверхности `@supabase/supabase-js`, которое реально использует кодовая база
 * (см. аудит поверхности). Цель — снять зависимость от Supabase/PostgREST,
 * НЕ переписывая 60+ call-site'ов: `supabaseAdmin().from(...)/.rpc(...)` остаются.
 *
 * Поддерживается: select/insert/update/upsert/delete; фильтры
 * eq/neq/gt/gte/lt/lte/in/is/not; модификаторы order/limit; терминалы
 * single/maybeSingle/await; `{ count:'exact', head:true }`; RETURNING через .select();
 * .rpc(name, params) с именованными аргументами.
 *
 * Любые значения параметризуются ($1,$2,…). Идентификаторы (таблицы/колонки)
 * приходят из строковых литералов кода (не из пользовательского ввода) и
 * дополнительно валидируются регуляркой — инъекция исключена.
 */

export type DbError = { message: string; code?: string };
export type DbResult<T = unknown> = { data: T; error: DbError | null; count?: number | null };
// Результат await на наборе строк — массив (как нетипизированный supabase-js),
// чтобы .map()/.filter() получали контекст и не падали в implicit-any.
type RowsResult = { data: any[]; error: DbError | null; count?: number | null };
type RowResult = { data: any; error: DbError | null; count?: number | null };

export type Runner = (text: string, values: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;

const IDENT = /^[a-z_][a-z0-9_]*$/i;

function ident(name: string): string {
  const n = name.trim();
  if (n === "*") return "*";
  // PostgREST-фичи, которых native-адаптер НЕ умеет, — это ошибки кода (а не данных).
  // Раньше они тихо валились в swallowed {error} и call-site показывал пустую страницу.
  // Теперь — внятный throw, который доходит до разработчика (см. run(): compile вне try/catch).
  if (n.includes("("))
    throw new Error(
      `embedded resources are not supported by the native adapter (got "${name}"); ` +
        `fetch the related table separately (.in(...)) and stitch in JS`,
    );
  if (n.includes("."))
    throw new Error(
      `dotted column paths (embedded filter/order) are not supported (got "${name}"); ` +
        `filter the related table separately`,
    );
  if (!IDENT.test(n)) throw new Error(`unsafe identifier: ${name}`);
  return `"${n}"`;
}

function columnsList(cols: string): string {
  // "a, b, c" | "*" | "id"
  const trimmed = cols.trim();
  if (trimmed === "*") return "*";
  return trimmed
    .split(",")
    .map((c) => ident(c))
    .join(", ");
}

type CmpOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is";
type Filter = { negate: boolean; col: string; op: CmpOp; val: unknown };
type Order = { col: string; ascending: boolean };

const OPSYM: Record<Exclude<CmpOp, "in" | "is">, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

type Op = "select" | "insert" | "update" | "delete" | "upsert";

export interface Compiled {
  text: string;
  values: unknown[];
}

export class Query implements PromiseLike<RowsResult> {
  private _op: Op = "select";
  private _columns = "*";
  private _count: "exact" | null = null;
  private _head = false;
  private _payload: Record<string, unknown>[] = [];
  private _onConflict: string | null = null;
  private _ignoreDup = false;
  private _returning = false;
  private _filters: Filter[] = [];
  private _orders: Order[] = [];
  private _limit: number | null = null;
  private _terminal: "rows" | "single" | "maybe" = "rows";

  constructor(
    private readonly table: string,
    private readonly runner: Runner,
  ) {}

  // ───── operations ─────
  select(columns = "*", opts?: { count?: "exact"; head?: boolean }): this {
    if (this._op === "select") {
      this._columns = columns;
      if (opts?.count) this._count = opts.count;
      if (opts?.head) this._head = true;
    } else {
      // .insert(..).select() / .update(..).select() → RETURNING
      this._returning = true;
    }
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this._op = "insert";
    this._payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Record<string, unknown>): this {
    this._op = "update";
    this._payload = [patch];
    return this;
  }
  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): this {
    this._op = "upsert";
    this._payload = Array.isArray(rows) ? rows : [rows];
    this._onConflict = opts?.onConflict ?? null;
    this._ignoreDup = opts?.ignoreDuplicates ?? false;
    return this;
  }
  delete(): this {
    this._op = "delete";
    return this;
  }

  // ───── filters ─────
  private push(negate: boolean, col: string, op: CmpOp, val: unknown): this {
    this._filters.push({ negate, col, op, val });
    return this;
  }
  eq(col: string, val: unknown) {
    return this.push(false, col, "eq", val);
  }
  neq(col: string, val: unknown) {
    return this.push(false, col, "neq", val);
  }
  gt(col: string, val: unknown) {
    return this.push(false, col, "gt", val);
  }
  gte(col: string, val: unknown) {
    return this.push(false, col, "gte", val);
  }
  lt(col: string, val: unknown) {
    return this.push(false, col, "lt", val);
  }
  lte(col: string, val: unknown) {
    return this.push(false, col, "lte", val);
  }
  in(col: string, arr: unknown[]) {
    return this.push(false, col, "in", arr);
  }
  is(col: string, val: null | boolean) {
    return this.push(false, col, "is", val);
  }
  not(col: string, op: CmpOp, val: unknown) {
    return this.push(true, col, op, val);
  }

  // ───── modifiers ─────
  order(col: string, opts?: { ascending?: boolean }): this {
    this._orders.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number): this {
    this._limit = n;
    return this;
  }

  // ───── filter SQL ─────
  private cond(f: Filter, p: (v: unknown) => string): string {
    const col = ident(f.col);
    let base: string;
    if (f.op === "is") {
      base = f.val === null ? `${col} IS NULL` : `${col} IS ${f.val ? "TRUE" : "FALSE"}`;
    } else if (f.op === "in") {
      base = `${col} = ANY(${p(f.val)})`;
    } else {
      base = `${col} ${OPSYM[f.op]} ${p(f.val)}`;
    }
    return f.negate ? `NOT (${base})` : base;
  }

  private whereClause(values: unknown[]): string {
    if (!this._filters.length) return "";
    const p = (v: unknown) => {
      values.push(v);
      return `$${values.length}`;
    };
    return " WHERE " + this._filters.map((f) => this.cond(f, p)).join(" AND ");
  }

  private tailClause(): string {
    let s = "";
    if (this._orders.length) {
      s +=
        " ORDER BY " +
        this._orders.map((o) => `${ident(o.col)} ${o.ascending ? "ASC" : "DESC"}`).join(", ");
    }
    if (this._limit !== null) s += ` LIMIT ${Number(this._limit)}`;
    return s;
  }

  // ───── compile ─────
  compile(): Compiled {
    const t = ident(this.table);
    const values: unknown[] = [];

    if (this._op === "select") {
      if (this._head && this._count) {
        return { text: `SELECT count(*)::int AS __count FROM ${t}${this.whereClause(values)}`, values };
      }
      const cols = columnsList(this._columns);
      const sel = this._count ? `${cols}, count(*) OVER()::int AS __count` : cols;
      return {
        text: `SELECT ${sel} FROM ${t}${this.whereClause(values)}${this.tailClause()}`,
        values,
      };
    }

    if (this._op === "insert" || this._op === "upsert") {
      const cols = Object.keys(this._payload[0] ?? {});
      if (!cols.length) throw new Error(`${this._op} with no columns on ${this.table}`);
      const colSql = cols.map((c) => ident(c)).join(", ");
      const tuples = this._payload
        .map((row) => "(" + cols.map((c) => {
          values.push(row[c]);
          return `$${values.length}`;
        }).join(", ") + ")")
        .join(", ");
      let text = `INSERT INTO ${t} (${colSql}) VALUES ${tuples}`;
      if (this._op === "upsert") {
        const conflictCols = (this._onConflict ?? cols.join(","))
          .split(",")
          .map((c) => ident(c))
          .join(", ");
        const conflictSet = new Set((this._onConflict ?? "").split(",").map((c) => c.trim()));
        const updates = cols.filter((c) => !conflictSet.has(c));
        text +=
          this._ignoreDup || !updates.length
            ? ` ON CONFLICT (${conflictCols}) DO NOTHING`
            : ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates
                .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
                .join(", ")}`;
      }
      if (this._returning) text += " RETURNING *";
      return { text, values };
    }

    if (this._op === "update") {
      const patch = this._payload[0] ?? {};
      const cols = Object.keys(patch);
      if (!cols.length) throw new Error(`update with no columns on ${this.table}`);
      const setSql = cols
        .map((c) => {
          values.push(patch[c]);
          return `${ident(c)} = $${values.length}`;
        })
        .join(", ");
      let text = `UPDATE ${t} SET ${setSql}${this.whereClause(values)}`;
      if (this._returning) text += " RETURNING *";
      return { text, values };
    }

    // delete
    let text = `DELETE FROM ${t}${this.whereClause(values)}`;
    if (this._returning) text += " RETURNING *";
    return { text, values };
  }

  // ───── execution ─────
  private async run(): Promise<DbResult<any>> {
    // compile() бросает ТОЛЬКО на неподдерживаемом/небезопасном построении запроса —
    // это баг кода, а не рантайм-условие. Намеренно НЕ глотаем: пусть падает громко
    // (видимый 500), а не маскируется под «пустой результат». Это корень того, почему
    // битый embed-запрос превращался в тихо пустую admin-страницу.
    const { text, values } = this.compile();
    let res: { rows: any[]; rowCount: number | null };
    try {
      res = await this.runner(text, values);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return { data: null, error: { message: err?.message ?? String(e), code: err?.code }, count: null };
    }
    const rows = res.rows ?? [];

    if (this._op === "select" && this._head && this._count) {
      return { data: null, error: null, count: rows[0]?.__count ?? 0 };
    }

    let count: number | null = null;
    if (this._count && rows.length && "__count" in rows[0]) {
      count = rows[0].__count;
      for (const r of rows) delete r.__count;
    }

    if (this._terminal === "single") {
      if (rows.length === 1) return { data: rows[0], error: null, count };
      return {
        data: null,
        error: { message: rows.length === 0 ? "no rows" : "multiple rows", code: "PGRST116" },
        count,
      };
    }
    if (this._terminal === "maybe") {
      if (rows.length <= 1) return { data: rows[0] ?? null, error: null, count };
      return { data: null, error: { message: "multiple rows", code: "PGRST116" }, count };
    }

    // await (rows / mutation)
    if (this._op === "select") return { data: rows, error: null, count };
    return { data: this._returning ? rows : null, error: null, count };
  }

  single(): Promise<RowResult> {
    this._terminal = "single";
    if (this._op !== "select") this._returning = true;
    return this.run();
  }
  maybeSingle(): Promise<RowResult> {
    this._terminal = "maybe";
    if (this._op !== "select") this._returning = true;
    return this.run();
  }

  then<R1 = RowsResult, R2 = never>(
    onfulfilled?: ((value: RowsResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.run().then(onfulfilled as never, onrejected);
  }
}

// Функции, возвращающие набор строк (returns table/setof) — для них .rpc отдаёт массив,
// как делал supabase-js. Остальные (returns int/boolean/jsonb) — скалярное значение.
export const SET_RETURNING = new Set([
  "process_interest",
  "get_recommendations",
  "get_chat_list",
  // C-032: outbox claim (returns setof tg_outbox) + accept_interest/send_chat_message
  // (returns table) — .rpc должен отдавать массив, а не скаляр.
  "claim_tg_outbox",
  "claim_tg_outbox_one",
  "accept_interest",
  "send_chat_message",
  // Найдено guard-тестом set-returning-guard.test.ts (тот же баг-класс, что
  // accept_interest): обе returns table, вызываются, но читались скаляром.
  // admin_ban_expire_sweep — РЕАЛЬНЫЙ баг: guard.ts итерирует data с доступом к
  // полям (row.proposer_id) → на скаляр-строке ломался аудит истечения бана.
  // admin_sla_reclaim_stale_cases — результат только логировался (безобидно, но форма неверна).
  "admin_ban_expire_sweep",
  "admin_sla_reclaim_stale_cases",
]);
const FN_NAME = /^[a-z_][a-z0-9_]*$/;

export function createDbClient(runner: Runner) {
  return {
    from(table: string): Query {
      return new Query(table, runner);
    },
    async rpc(name: string, params: Record<string, unknown> = {}): Promise<RowResult> {
      if (!FN_NAME.test(name)) return { data: null, error: { message: `bad function: ${name}` } };
      const keys = Object.keys(params);
      const values: unknown[] = [];
      const args = keys
        .map((k) => {
          if (!FN_NAME.test(k)) throw new Error(`bad arg: ${k}`);
          values.push(params[k]);
          return `${k} => $${values.length}`;
        })
        .join(", ");
      const isSet = SET_RETURNING.has(name);
      const text = isSet
        ? `SELECT * FROM ${name}(${args})`
        : `SELECT ${name}(${args}) AS v`;
      try {
        const res = await runner(text, values);
        const rows = res.rows ?? [];
        if (isSet) return { data: rows, error: null };
        return { data: rows[0]?.v ?? null, error: null };
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string };
        return { data: null, error: { message: err?.message ?? String(e), code: err?.code } };
      }
    },
  };
}

export type DbClient = ReturnType<typeof createDbClient>;
