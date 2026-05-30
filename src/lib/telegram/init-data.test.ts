import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/env", () => ({
  env: () => ({ TELEGRAM_BOT_TOKEN: "TEST_TOKEN_long_enough_for_zod_min20" }),
}));

import { verifyInitData, InitDataError } from "./init-data";

function makeInitData(token: string, fields: Record<string, string>, ts?: number): string {
  const auth_date = String(ts ?? Math.floor(Date.now() / 1000));
  const params: Record<string, string> = { ...fields, auth_date };
  const dcs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(dcs).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

describe("verifyInitData", () => {
  it("принимает валидную подпись", () => {
    const raw = makeInitData("TEST_TOKEN_long_enough_for_zod_min20", {
      user: '{"id":1,"first_name":"Ali"}',
      query_id: "Q1",
    });
    const r = verifyInitData(raw);
    expect(r.user?.id).toBe(1);
    expect(r.user?.first_name).toBe("Ali");
    expect(r.query_id).toBe("Q1");
  });

  it("отклоняет неверную подпись", () => {
    const raw = makeInitData("WRONG_TOKEN", { user: '{"id":1}' });
    expect(() => verifyInitData(raw)).toThrow(InitDataError);
  });

  it("отклоняет просроченную initData", () => {
    const old = Math.floor(Date.now() / 1000) - 200_000;
    const raw = makeInitData("TEST_TOKEN_long_enough_for_zod_min20", { user: '{"id":1}' }, old);
    expect(() => verifyInitData(raw)).toThrow(/expired/);
  });

  it("bypass пропускает проверку подписи и возраста (dev)", () => {
    const old = Math.floor(Date.now() / 1000) - 200_000;
    const raw = makeInitData("WRONG_TOKEN", { user: '{"id":42}' }, old);
    const r = verifyInitData(raw, { bypass: true });
    expect(r.user?.id).toBe(42);
  });

  it("пустая строка → ошибка", () => {
    expect(() => verifyInitData("")).toThrow(/empty/);
  });
});
