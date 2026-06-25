/**
 * V2 Phase A · Sprint 5 — withPermission API route gate.
 *
 * Единая обёртка для route handlers вместо повторения паттерна
 *   loadActiveUserApi → deriveRole → hasPermission(...) → 403
 * во всех роутах.
 *
 * Использование:
 *   export async function POST(req: NextRequest) {
 *     const gate = await requirePermissionForRequest("send_interest");
 *     if ("response" in gate) return gate.response;
 *     const { user, role } = gate;
 *     // ... handler
 *   }
 *
 * Эшелон №2 защиты (Blueprint §2.8). Эшелон №3 — RPC SECURITY DEFINER
 * (defense-in-depth, см. 20260626 миграция). Эшелон №1 — middleware
 * (Sprint 7).
 *
 * Не делает auto-redirect для unauth — это API роуты, отвечают JSON.
 * Page-level guard живёт отдельно в src/lib/state-machine/guard.ts.
 */

import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type DbUser } from "@/lib/auth/current-user";
import { deriveRole, hasPermission, type Permission, type Role } from "@/lib/v2/permissions";

export type PermissionGateResult =
  | { user: DbUser; role: Role }
  | { response: NextResponse };

/**
 * Проверка одного permission. Возвращает либо { user, role } для продолжения,
 * либо { response } с готовым JSON 401/403.
 *
 * Коды ошибок:
 *   401 no_session              — нет cookie сессии
 *   403 blocked                 — lifecycle=blocked (даже если есть delete_account)
 *   403 deleted                 — lifecycle=deleted
 *   403 permission_denied       — роль не имеет permission
 */
export async function requirePermissionForRequest(
  permission: Permission,
): Promise<PermissionGateResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ ok: false, error: "no_session" }, { status: 401 }),
    };
  }

  // lifecycle terminal states получают точечные ошибки чтобы фронт мог
  // показать соответствующий UX (banned screen, deleted screen).
  if (user.lifecycle_state === "deleted") {
    return {
      response: NextResponse.json({ ok: false, error: "deleted" }, { status: 403 }),
    };
  }

  const role = deriveRole(user.lifecycle_state, user.verification_status);

  if (role === "blocked") {
    // blocked может delete_account / export_account (GDPR floor), но
    // ничего больше. Если permission в это множество входит — пропускаем.
    if (!hasPermission(role, permission)) {
      return {
        response: NextResponse.json({ ok: false, error: "blocked" }, { status: 403 }),
      };
    }
    return { user, role };
  }

  if (!hasPermission(role, permission)) {
    return {
      response: NextResponse.json(
        { ok: false, error: "permission_denied", required: permission, role },
        { status: 403 },
      ),
    };
  }

  return { user, role };
}

/**
 * Проверка нескольких permissions (AND). Удобно для роутов которые делают
 * несколько действий за один POST. Возвращает первую упавшую проверку.
 */
export async function requireAllPermissionsForRequest(
  permissions: Permission[],
): Promise<PermissionGateResult> {
  let gate: PermissionGateResult | null = null;
  for (const p of permissions) {
    gate = await requirePermissionForRequest(p);
    if ("response" in gate) return gate;
  }
  // Если permissions пустой — это программная ошибка вызова. Считаем
  // что подразумевалось "просто сессия должна быть" — возвращаем последний
  // результат или 500.
  if (!gate) {
    return {
      response: NextResponse.json({ ok: false, error: "no_permissions_specified" }, { status: 500 }),
    };
  }
  return gate;
}
