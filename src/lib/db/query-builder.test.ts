import { describe, it, expect } from "vitest";
import { createDbClient, type Runner } from "./query-builder";

/** recording runner — фиксирует последний SQL+params и отдаёт заданные строки */
function rec(rows: any[] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const runner: Runner = async (text, values) => {
    calls.push({ text, values });
    return { rows, rowCount: rows.length };
  };
  return { runner, calls, last: () => calls[calls.length - 1] };
}

describe("query-builder: select", () => {
  it("select * with eq + single", async () => {
    const { runner, last } = rec([{ id: "u1" }]);
    const db = createDbClient(runner);
    const r = await db.from("users").select("*").eq("id", "u1").single();
    expect(last().text).toBe('SELECT * FROM "users" WHERE "id" = $1');
    expect(last().values).toEqual(["u1"]);
    expect(r.data).toEqual({ id: "u1" });
    expect(r.error).toBeNull();
  });

  it("select column list", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("users").select("id, telegram_id, lifecycle_state").eq("id", "x").maybeSingle();
    expect(last().text).toBe(
      'SELECT "id", "telegram_id", "lifecycle_state" FROM "users" WHERE "id" = $1',
    );
  });

  it("count + head → __count, data null", async () => {
    const { runner, last } = rec([{ __count: 7 }]);
    const db = createDbClient(runner);
    const r = await db.from("profile_photos").select("id", { count: "exact", head: true }).eq("user_id", "u");
    expect(last().text).toBe('SELECT count(*)::int AS __count FROM "profile_photos" WHERE "user_id" = $1');
    expect(r.data).toBeNull();
    expect(r.count).toBe(7);
  });

  it("order desc + limit", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("otp_codes").select("*").eq("user_id", "u").order("created_at", { ascending: false }).limit(1);
    expect(last().text).toBe(
      'SELECT * FROM "otp_codes" WHERE "user_id" = $1 ORDER BY "created_at" DESC LIMIT 1',
    );
  });

  it("in / is null / not is null", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("profile_photos").select("user_id").in("user_id", ["a", "b"]);
    expect(last().text).toBe('SELECT "user_id" FROM "profile_photos" WHERE "user_id" = ANY($1)');
    expect(last().values).toEqual([["a", "b"]]);

    await db.from("otp_codes").select("*").is("used_at", null);
    expect(last().text).toBe('SELECT * FROM "otp_codes" WHERE "used_at" IS NULL');

    await db.from("chat_messages").select("*").not("read_at", "is", null);
    expect(last().text).toBe('SELECT * FROM "chat_messages" WHERE NOT ("read_at" IS NULL)');
  });

  it("maybeSingle returns null on 0 rows", async () => {
    const { runner } = rec([]);
    const r = await createDbClient(runner).from("users").select("*").eq("id", "none").maybeSingle();
    expect(r.data).toBeNull();
    expect(r.error).toBeNull();
  });

  it("single errors (PGRST116) on 0 rows", async () => {
    const { runner } = rec([]);
    const r = await createDbClient(runner).from("users").select("*").eq("id", "none").single();
    expect(r.data).toBeNull();
    expect(r.error?.code).toBe("PGRST116");
  });
});

describe("query-builder: mutations", () => {
  it("insert single + select + single → RETURNING", async () => {
    const { runner, last } = rec([{ id: "c1" }]);
    const db = createDbClient(runner);
    const r = await db.from("chats").insert({ user_a: "a", user_b: "b" }).select().single();
    expect(last().text).toBe('INSERT INTO "chats" ("user_a", "user_b") VALUES ($1, $2) RETURNING *');
    expect(last().values).toEqual(["a", "b"]);
    expect(r.data).toEqual({ id: "c1" });
  });

  it("insert multi-row, no returning → data null", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    const r = await db.from("quiz_answers").insert([{ q: "1" }, { q: "2" }]);
    expect(last().text).toBe('INSERT INTO "quiz_answers" ("q") VALUES ($1), ($2)');
    expect(last().values).toEqual(["1", "2"]);
    expect(r.data).toBeNull();
  });

  it("update + eq + select single", async () => {
    const { runner, last } = rec([{ id: 5, x: 1 }]);
    const db = createDbClient(runner);
    await db.from("t").update({ x: 1 }).eq("id", 5).select().single();
    expect(last().text).toBe('UPDATE "t" SET "x" = $1 WHERE "id" = $2 RETURNING *');
    expect(last().values).toEqual([1, 5]);
  });

  it("update fire-and-forget (no returning)", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    const r = await db.from("otp_codes").update({ used_at: "now" }).eq("user_id", "u").is("used_at", null);
    expect(last().text).toBe('UPDATE "otp_codes" SET "used_at" = $1 WHERE "user_id" = $2 AND "used_at" IS NULL');
    expect(r.data).toBeNull();
  });

  it("upsert single col=user_id → DO UPDATE non-conflict cols", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("user_profiles").upsert({ user_id: "u", city: "Tashkent" }, { onConflict: "user_id" });
    expect(last().text).toBe(
      'INSERT INTO "user_profiles" ("user_id", "city") VALUES ($1, $2) ON CONFLICT ("user_id") DO UPDATE SET "city" = EXCLUDED."city"',
    );
  });

  it("upsert all-conflict cols → DO NOTHING", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("match_views").upsert({ viewer_id: "a", target_id: "b" }, { onConflict: "viewer_id,target_id" });
    expect(last().text).toBe(
      'INSERT INTO "match_views" ("viewer_id", "target_id") VALUES ($1, $2) ON CONFLICT ("viewer_id", "target_id") DO NOTHING',
    );
  });

  it("delete + eq", async () => {
    const { runner, last } = rec([]);
    const db = createDbClient(runner);
    await db.from("profile_photos").delete().eq("id", "p1");
    expect(last().text).toBe('DELETE FROM "profile_photos" WHERE "id" = $1');
  });
});

describe("query-builder: rpc", () => {
  it("scalar function → SELECT fn(...) AS v, unwrapped", async () => {
    const { runner, last } = rec([{ v: true }]);
    const db = createDbClient(runner);
    const r = await db.rpc("bump_quota", { p_user: "u", p_kind: "interests", p_limit: 5 });
    expect(last().text).toBe("SELECT bump_quota(p_user => $1, p_kind => $2, p_limit => $3) AS v");
    expect(last().values).toEqual(["u", "interests", 5]);
    expect(r.data).toBe(true);
  });

  it("set-returning function → SELECT * FROM fn(...), array", async () => {
    const { runner, last } = rec([{ result: "sent", chat_id: null }]);
    const db = createDbClient(runner);
    const r = await db.rpc("process_interest", { p_sender: "a", p_receiver: "b", p_message: null, p_hours: 72, p_limit: 5 });
    expect(last().text).toBe(
      "SELECT * FROM process_interest(p_sender => $1, p_receiver => $2, p_message => $3, p_hours => $4, p_limit => $5)",
    );
    expect(Array.isArray(r.data)).toBe(true);
    expect((r.data as any[])[0].result).toBe("sent");
  });

  it("scalar jsonb (transition_user) → object", async () => {
    const { runner } = rec([{ v: { ok: true } }]);
    const db = createDbClient(runner);
    const r = await db.rpc("transition_user", { p_user_id: "u", p_patch: { a: 1 } });
    expect(r.data).toEqual({ ok: true });
  });
});

describe("query-builder: safety + errors", () => {
  // Ошибки построения запроса (compile) — это баги кода, а не данных: они должны
  // ПАДАТЬ ГРОМКО, а не маскироваться под пустой результат (см. фикс silent-empty admin-страниц).
  it("throws loudly on unsafe identifiers (not swallowed)", async () => {
    const { runner } = rec([]);
    const db = createDbClient(runner);
    await expect(db.from("users").select("*").eq("id; DROP TABLE users; --", 1)).rejects.toThrow(
      /unsafe identifier/,
    );
  });

  it("throws clear error on PostgREST embed syntax table(cols)", async () => {
    const { runner } = rec([]);
    const db = createDbClient(runner);
    await expect(
      db.from("profile_photos").select("id, user_id, users(telegram_first_name, telegram_username)"),
    ).rejects.toThrow(/embedded resources are not supported/);
  });

  it("throws clear error on dotted embedded filter path", async () => {
    const { runner } = rec([]);
    const db = createDbClient(runner);
    await expect(db.from("users").select("id").eq("user_profiles.gender", "f")).rejects.toThrow(
      /dotted column paths/,
    );
  });

  it("runner throw → error shape with message+code", async () => {
    const runner: Runner = async () => {
      throw Object.assign(new Error("db down"), { code: "57P01" });
    };
    const r = await createDbClient(runner).from("users").select("*");
    expect(r.error).toEqual({ message: "db down", code: "57P01" });
  });
});
