import { describe, it, expect } from "vitest";
import { can, PERMISSIONS, type Permission } from "./permissions";

// СПИНА ВОЛНЫ 7: явная матрица role×capability. Этот тест — настоящая проверка
// поведение-сохраняющего рефактора (build/tsc НЕ поймают ослабленный гейт).
// Любое изменение доступа обязано осознанно менять ЭТУ таблицу.

// Полный ожидаемый список прав модератора. Меняется ТОЛЬКО осознанно.
const MODERATOR_EXPECTED: Permission[] = [
  "queue.work",
  "photos.moderate",
  "reports.triage", // ← НАМЕРЕННО открыто модератору в Волне 7
  "users.moderate",
  "profiles.edit", // ← 2026-07-14: правка анкет открыта модераторам (ревью оунера)
];

// Права, которых у модератора быть НЕ должно (super-only). Явно, чтобы случайное
// добавление к MODERATOR_CAPS завалило тест.
const MODERATOR_FORBIDDEN: Permission[] = [
  "queue.viewAll",
  "clients.directory",
  "users.sanction",
  "analytics.view",
  "audit.viewAll",
  "staff.manage",
  "settings.edit",
];

describe("RBAC capability matrix", () => {
  it("MODERATOR_EXPECTED + MODERATOR_FORBIDDEN покрывают ВСЕ права (нет забытых)", () => {
    const covered = new Set<string>([...MODERATOR_EXPECTED, ...MODERATOR_FORBIDDEN]);
    expect([...covered].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("superadmin имеет ВСЕ права", () => {
    for (const p of PERMISSIONS) {
      expect(can("superadmin", p)).toBe(true);
    }
  });

  it("moderator имеет ровно MODERATOR_EXPECTED", () => {
    for (const p of MODERATOR_EXPECTED) {
      expect(can("moderator", p)).toBe(true);
    }
  });

  it("moderator НЕ имеет ни одного super-only права", () => {
    for (const p of MODERATOR_FORBIDDEN) {
      expect(can("moderator", p)).toBe(false);
    }
  });

  it("default-deny: неизвестная/пустая роль не имеет ничего", () => {
    for (const p of PERMISSIONS) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
      expect(can("", p)).toBe(false);
      expect(can("hacker", p)).toBe(false);
      expect(can("SUPERADMIN", p)).toBe(false); // регистр важен
    }
  });

  it("reports.triage доступно ОБОИМ ролям (изменение Волны 7)", () => {
    expect(can("superadmin", "reports.triage")).toBe(true);
    expect(can("moderator", "reports.triage")).toBe(true);
  });

  it("деструктив (users.sanction) и PII-директория (clients.directory) — ТОЛЬКО super", () => {
    expect(can("moderator", "users.sanction")).toBe(false);
    expect(can("moderator", "clients.directory")).toBe(false);
    expect(can("superadmin", "users.sanction")).toBe(true);
    expect(can("superadmin", "clients.directory")).toBe(true);
  });
});
