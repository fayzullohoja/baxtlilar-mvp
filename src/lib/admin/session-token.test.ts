import { describe, it, expect } from "vitest";
import { packToken, unpackToken, type AdminSession } from "./session-token";

const SECRET = "test-secret-0000000000000000000000";
const SUPER: AdminSession = { adminId: "a1", role: "superadmin" };
const MOD: AdminSession = { adminId: "m1", role: "moderator" };
const H8 = 60 * 60 * 8;
const M5 = 5 * 60;

describe("админский токен: разделение назначения (SEC-2d, обход 2FA)", () => {
  it("⛔ pending-токен НЕ принимается как полноценная сессия (суть дыры)", () => {
    // Атака: пароль верный → выдан bx_admin_totp (ещё БЕЗ второго фактора) →
    // значение скопировано в куку bx_admin через devtools.
    const pending = packToken("pending", SUPER, SECRET);
    expect(unpackToken("admin", pending, SECRET, H8)).toBeNull();
  });

  it("⛔ и обратно: полноценная сессия не сходит за pending", () => {
    const admin = packToken("admin", SUPER, SECRET);
    expect(unpackToken("pending", admin, SECRET, M5)).toBeNull();
  });

  it("каждый scope принимает свой токен", () => {
    expect(unpackToken("admin", packToken("admin", SUPER, SECRET), SECRET, H8)).toEqual(SUPER);
    expect(unpackToken("pending", packToken("pending", MOD, SECRET), SECRET, M5)).toEqual(MOD);
  });

  it("подделка подписи отвергается", () => {
    const t = packToken("admin", SUPER, SECRET);
    const [b64] = t.split(".");
    expect(unpackToken("admin", `${b64}.подделка`, SECRET, H8)).toBeNull();
    expect(unpackToken("admin", t, "другой-секрет", H8)).toBeNull();
  });

  it("нельзя поднять роль правкой payload (подпись перестаёт сходиться)", () => {
    const t = packToken("admin", MOD, SECRET);
    const [, sig] = t.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...MOD, role: "superadmin", iat: Date.now() }))
      .toString("base64url");
    expect(unpackToken("admin", `${tampered}.${sig}`, SECRET, H8)).toBeNull();
  });

  it("срок жизни соблюдается для каждого scope", () => {
    const t0 = 1_000_000_000_000;
    const pending = packToken("pending", SUPER, SECRET, t0);
    expect(unpackToken("pending", pending, SECRET, M5, t0 + M5 * 1000 - 1)).toEqual(SUPER);
    expect(unpackToken("pending", pending, SECRET, M5, t0 + M5 * 1000 + 1)).toBeNull();

    const admin = packToken("admin", SUPER, SECRET, t0);
    expect(unpackToken("admin", admin, SECRET, H8, t0 + H8 * 1000 + 1)).toBeNull();
  });

  it("мусор и обрезанные токены не роняют разбор", () => {
    for (const bad of ["", ".", "abc", "abc.def", "...", "eyJ9.x"]) {
      expect(unpackToken("admin", bad, SECRET, H8)).toBeNull();
    }
  });

  it("неизвестная роль отвергается (default-deny)", () => {
    const b64 = Buffer.from(JSON.stringify({ adminId: "x", role: "root", iat: Date.now() }))
      .toString("base64url");
    // подписываем корректно — отвергнуть должна проверка роли, а не подпись
    const valid = packToken("admin", SUPER, SECRET);
    const sig = valid.split(".")[1];
    expect(unpackToken("admin", `${b64}.${sig}`, SECRET, H8)).toBeNull();
  });
});
