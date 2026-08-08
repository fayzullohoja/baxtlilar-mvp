import "server-only";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getAdminSession, type AdminSession } from "./session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { trustedIp } from "@/lib/http/ip";
import { notifyUser } from "@/lib/telegram/notify";

export type AdminRow = { id: string; login: string; role: "superadmin" | "moderator" };

/** Свежие данные админа из БД (роль авторитетна тут, не в куке). null → удалён
 *  ИЛИ деактивирован (staff-управление): деактивированный аккаунт мгновенно
 *  теряет доступ на следующем запросе, даже с валидной кукой. */
async function freshAdmin(adminId: string): Promise<{ id: string; role: "superadmin" | "moderator" } | null> {
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("id, role, active")
    .eq("id", adminId)
    .maybeSingle();
  if (!data || data.active === false) return null;
  return { id: data.id as string, role: data.role as "superadmin" | "moderator" };
}

/** Для admin-страниц: вернуть сессию (роль — из БД) или редирект на /admin/login. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  const fresh = await freshAdmin(s!.adminId);
  if (!fresh) redirect("/admin/login");
  return { ...s!, role: fresh!.role };
}

/** Для admin API-роутов: вернуть { session } (роль — из БД) или { res: 401 }. */
export async function requireAdminApi(): Promise<
  { session: AdminSession; res?: undefined } | { session?: undefined; res: NextResponse }
> {
  const s = await getAdminSession();
  if (!s) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  const fresh = await freshAdmin(s.adminId);
  if (!fresh) return { res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { session: { ...s, role: fresh.role } };
}

/**
 * Записать действие админа в audit log.
 *
 * Раньше результат insert выбрасывался: сбой записи был НЕВИДИМ — действие
 * совершено, а следа «кто это сделал» нет (проблема для разбора инцидентов и
 * требований по ПД).
 *
 * Ошибку НЕ бросаем осознанно: аудит пишется ПОСЛЕ самой мутации, и 500 в ответ
 * соврал бы оператору об исходе — он повторил бы бан/удаление. Вместо этого
 * делаем потерю громкой в логах (и не глотаем исключения драйвера).
 */
export async function adminAudit(params: {
  adminId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ip?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("admin_audit_log").insert({
      admin_id: params.adminId,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      reason: params.reason ?? null,
      ip: params.ip ?? null,
    });
    if (error) {
      console.error(
        `[AUDIT LOST] admin=${params.adminId} action=${params.action} entity=${params.entity}:${params.entityId ?? "-"} — ${error.message}`,
      );
    }
  } catch (e) {
    console.error(
      `[AUDIT LOST] admin=${params.adminId} action=${params.action} entity=${params.entity}:${params.entityId ?? "-"} —`,
      e,
    );
  }
}

// =============================================================================
//  F-119: two-person ban dispatcher
// =============================================================================

export const BAN_PROPOSAL_TTL_SECONDS = 24 * 60 * 60;

type BanRpcResult = {
  ok: boolean;
  error?: string;
  [k: string]: unknown;
};

function rpcErrorToHttp(r: BanRpcResult): NextResponse {
  switch (r.error) {
    case "reason_required":
      return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });
    case "already_pending":
      return NextResponse.json(
        { ok: false, error: "already_pending", pending_until: r.pending_until, pending_by: r.pending_by },
        { status: 409 },
      );
    case "not_eligible":
      return NextResponse.json({ ok: false, error: "not_eligible", state: r.state }, { status: 409 });
    case "no_pending_proposal":
      return NextResponse.json({ ok: false, error: "no_pending_proposal" }, { status: 409 });
    case "same_admin":
      return NextResponse.json({ ok: false, error: "same_admin" }, { status: 403 });
    case "expired":
      return NextResponse.json({ ok: false, error: "expired" }, { status: 409 });
    case "conflict":
      return NextResponse.json({ ok: false, error: "conflict" }, { status: 409 });
    case "not_found":
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    default:
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

/**
 * Lazy expire-sweep: вызывается перед каждым /ban POST'ом, чтобы протухшие
 * proposals автоматически возвращали юзера в active/onboarding и
 * залогировались в admin_audit_log как `ban_proposal_expired`.
 */
async function runBanExpirySweep(): Promise<void> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("admin_ban_expire_sweep", {
    p_ttl_seconds: BAN_PROPOSAL_TTL_SECONDS,
    p_limit: 200,
  });
  if (error) {
    console.error("[ban] expire_sweep RPC failed:", error.message);
    return;
  }
  type Row = { user_id: string; proposer_id: string; proposer_reason: string; restored_state: string };
  for (const row of (data as Row[]) ?? []) {
    await adminAudit({
      adminId: row.proposer_id,
      action: "ban_proposal_expired",
      entity: "user",
      entityId: row.user_id,
      oldValue: { lifecycle_state: "pending_ban", proposer_reason: row.proposer_reason },
      newValue: { lifecycle_state: row.restored_state },
    });
  }
}

export async function dispatchBanAction(
  session: AdminSession,
  userId: string,
  action: "propose" | "confirm" | "cancel",
  body: { reason?: string; confirm_reason_override?: string },
  req: NextRequest,
): Promise<NextResponse> {
  // F-119: только super-admin (как и было до pivot'а).
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Lazy TTL-sweep ДО любого действия — иначе можно "подтвердить" истёкший
  // proposal на стороне приложения, успев между чтением и UPDATE'ом.
  await runBanExpirySweep();

  const sb = supabaseAdmin();
  const { data: user, error: selErr } = await sb
    .from("users")
    .select(
      "id, telegram_id, updated_at, lifecycle_state, quiz_completion, profile_completion, pending_ban_at, pending_ban_by_admin_id, pending_ban_reason",
    )
    .eq("id", userId)
    .maybeSingle();
  if (selErr) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  if (!user) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (action === "propose") {
    const reason = (body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });
    const { data, error } = await sb.rpc("admin_ban_propose", {
      p_user_id: userId,
      p_admin_id: session.adminId,
      p_reason: reason,
      p_expected_updated_at: user.updated_at,
    });
    if (error) {
      console.error("[ban] propose RPC error:", error.message);
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
    const r = data as BanRpcResult;
    if (!r.ok) return rpcErrorToHttp(r);
    await adminAudit({
      adminId: session.adminId,
      action: "ban_proposed",
      entity: "user",
      entityId: userId,
      newValue: { lifecycle_state: "pending_ban", pending_until: r.pending_until },
      reason,
      ip: trustedIp(req),
    });
    return NextResponse.json({ ok: true, status: "pending", pending_until: r.pending_until });
  }

  if (action === "confirm") {
    const override = (body.confirm_reason_override ?? "").trim();
    const { data, error } = await sb.rpc("admin_ban_confirm", {
      p_user_id: userId,
      p_admin_id: session.adminId,
      p_ttl_seconds: BAN_PROPOSAL_TTL_SECONDS,
      p_blocked_reason_override: override || null,
      p_expected_updated_at: user.updated_at,
    });
    if (error) {
      console.error("[ban] confirm RPC error:", error.message);
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
    const r = data as BanRpcResult;
    if (!r.ok) return rpcErrorToHttp(r);
    await adminAudit({
      adminId: session.adminId,
      action: "ban_confirmed",
      entity: "user",
      entityId: userId,
      oldValue: {
        lifecycle_state: "pending_ban",
        proposer_admin_id: r.proposer_admin_id,
        proposer_reason: r.proposer_reason,
      },
      newValue: { lifecycle_state: "blocked", final_reason: r.final_reason },
      reason: override || (r.proposer_reason as string),
      ip: trustedIp(req),
    });
    // Best-effort push. telegram_id может быть null если юзера успели удалить.
    if (user.telegram_id) {
      await notifyUser(
        user.telegram_id as number,
        "Ваш аккаунт заблокирован модератором.\nHisobingiz moderator tomonidan bloklangan.",
      );
    }
    return NextResponse.json({ ok: true, status: "blocked" });
  }

  if (action === "cancel") {
    // Фаза 4 (§1.20): восстанавливаем в active ТОЛЬКО если юзер опубликовался
    // (profile_completion=completed ⟺ прошёл publish-гейт: gender-check/фото/полнота).
    // Раньше по quiz_completion — но после переноса preview опрос идёт ДО публикации,
    // и такой юзер мог бы попасть в active мимо гейта. profile_completion устойчив.
    const restored: "active" | "onboarding" =
      user.profile_completion === "completed" ? "active" : "onboarding";
    const { data, error } = await sb.rpc("admin_ban_cancel", {
      p_user_id: userId,
      p_admin_id: session.adminId,
      p_restore_state: restored,
      p_expected_updated_at: user.updated_at,
    });
    if (error) {
      console.error("[ban] cancel RPC error:", error.message);
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
    const r = data as BanRpcResult;
    if (!r.ok) return rpcErrorToHttp(r);
    await adminAudit({
      adminId: session.adminId,
      action: "ban_cancelled",
      entity: "user",
      entityId: userId,
      oldValue: {
        lifecycle_state: "pending_ban",
        proposer_admin_id: r.proposer_admin_id,
        proposer_reason: r.proposer_reason,
      },
      newValue: { lifecycle_state: restored },
      reason: (body.reason ?? "").trim() || undefined,
      ip: trustedIp(req),
    });
    return NextResponse.json({ ok: true, status: restored });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}

// =============================================================================
//  F-120: moderator data-scope helpers
// =============================================================================

const SCOPE_NS = "scope:v1:";
function hashEntityId(id: string): string {
  // HMAC-SHA256 по SESSION_SECRET с domain-separation. Не reverse'абельно без
  // секрета; корреляция между записями (тот же id → тот же hash) сохраняется.
  return crypto.createHmac("sha256", env().SESSION_SECRET).update(SCOPE_NS + id).digest("hex");
}

/**
 * Записать out-of-queue нарушение в admin_scope_violations с rate-bucket.
 * Если admin в этом окне уже превысил лимит — пишем единичный
 * out_of_queue_rate_exceeded вместо каждой попытки, чтобы атакующий не мог
 * зашумить лог тысячами строк и спрятать сигнал.
 */
async function recordScopeViolation(
  adminId: string,
  userId: string,
  action: "out_of_queue_doc_view" | "out_of_queue_decision_attempt" | "out_of_queue_user_view",
  req: NextRequest,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: admitted, error: admitErr } = await sb.rpc("admin_scope_violation_admit", {
    p_admin_id: adminId,
  });
  if (admitErr) {
    console.error("[scope] admit RPC error:", admitErr.message);
    return;
  }
  const finalAction = admitted === false ? "out_of_queue_rate_exceeded" : action;
  await sb.from("admin_scope_violations").insert({
    admin_id: adminId,
    action: finalAction,
    entity_id_hash: hashEntityId(userId),
    ip: trustedIp(req),
  });
}

/**
 * Гард для admin-роутов, обращающихся к данным конкретного юзера.
 *
 * - superadmin: пропускаем без чека (для incident-response).
 * - moderator: пускаем только если юзер в активной очереди модерации
 *   (verification_status='pending_review' AND lifecycle_state='onboarding').
 *   Иначе — 403 + запись в admin_scope_violations.
 *
 * R2-#8 (verdict): возвращаем 403 ВО ВСЕХ нелигитимных случаях (включая
 * "юзер не найден") — иначе 404 даёт existence-oracle (можно перебором UUID
 * вычислять реальные id). User-not-exist для moderator = "за пределами scope"
 * = тот же 403.
 *
 * Возвращает {ok:true,userId} или {res:NextResponse} с 4xx.
 */
export async function requireInQueueOrSuper(
  session: AdminSession,
  userId: string,
  context: "doc_view" | "decision" | "user_view",
  req: NextRequest,
): Promise<{ ok: true; userId: string } | { res: NextResponse }> {
  if (session.role === "superadmin") {
    // Для super-admin не делаем существование-чек тут — пускай route сам решит
    // (обычно сразу будет .from(...).eq(id) → 404 от своего запроса).
    return { ok: true, userId };
  }

  const sb = supabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("id, verification_status, lifecycle_state")
    .eq("id", userId)
    .maybeSingle();
  const inQueue = !!u && u.verification_status === "pending_review" && u.lifecycle_state === "onboarding";
  if (inQueue) return { ok: true, userId };

  // R2-#8: единый 403 для "не найден" и "вне очереди". Audit-запись пишем
  // только если юзер существует (нет смысла логировать нарушение по
  // несуществующему id — это шум при переборе).
  if (u) {
    await recordScopeViolation(
      session.adminId,
      userId,
      context === "doc_view"
        ? "out_of_queue_doc_view"
        : context === "decision"
          ? "out_of_queue_decision_attempt"
          : "out_of_queue_user_view",
      req,
    );
  }
  return { res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
}

/**
 * Server-page вариант requireInQueueOrSuper. Без NextResponse — возвращает
 * {ok:true} или {hide:true} (страница рисует notFound() сама, чтобы избежать
 * existence-oracle через 403/404).
 *
 * Используется в admin-pages /admin/verifications/[id], /admin/users/[id] и т.п.
 */
export async function checkInQueueOrSuperPage(
  session: AdminSession,
  userId: string,
  context: "user_view",
  ipAddr: string | null,
): Promise<{ ok: true } | { hide: true }> {
  if (session.role === "superadmin") return { ok: true };

  const sb = supabaseAdmin();
  const { data: u } = await sb
    .from("users")
    .select("id, verification_status, lifecycle_state")
    .eq("id", userId)
    .maybeSingle();
  const inQueue = !!u && u.verification_status === "pending_review" && u.lifecycle_state === "onboarding";
  if (inQueue) return { ok: true };

  if (u) {
    await recordScopeViolationServerPage(session.adminId, userId, context, ipAddr);
  }
  return { hide: true };
}

/** Server-page вариант без NextRequest (нет в RSC). IP пробрасывается явно. */
async function recordScopeViolationServerPage(
  adminId: string,
  userId: string,
  action: "user_view",
  ipAddr: string | null,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: admitted, error: admitErr } = await sb.rpc("admin_scope_violation_admit", {
    p_admin_id: adminId,
  });
  if (admitErr) {
    console.error("[scope] admit RPC error (server-page):", admitErr.message);
    return;
  }
  const finalAction = admitted === false ? "out_of_queue_rate_exceeded" : `out_of_queue_${action}`;
  await sb.from("admin_scope_violations").insert({
    admin_id: adminId,
    action: finalAction,
    entity_id_hash: hashEntityId(userId),
    ip: ipAddr,
  });
}
