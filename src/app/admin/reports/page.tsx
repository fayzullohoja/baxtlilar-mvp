import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { ReportActions } from "@/components/admin/report-actions";

export const dynamic = "force-dynamic";

const OPEN = ["new", "in_progress", "requires_clarification", "escalated"];
const REASON_RU: Record<string, string> = {
  fake: "Фейковый профиль",
  offensive: "Оскорбления",
  contacts: "Навязывает контакты",
  spam: "Спам",
  inappropriate: "Неприемлемо",
  other: "Другое",
};
const STATUS_RU: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  requires_clarification: "Нужны уточнения",
  escalated: "Эскалация",
};
const STATUS_KIND: Record<
  string,
  "new" | "warning" | "pending" | "rejected"
> = {
  new: "new",
  in_progress: "warning",
  requires_clarification: "pending",
  escalated: "rejected",
};

type Report = {
  id: string;
  target_user_id: string;
  chat_id: string | null;
  reason_code: string;
  comment: string | null;
  status: string;
  created_at: string;
};

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

/**
 * Admin · Reports (Blueprint §4.5).
 *
 * Open reports queue. Sender identity hidden. Super-admin only (F-120).
 */
export default async function ReportsModeration() {
  const session = await requireAdmin();
  if (!can(session.role, "reports.triage")) notFound();
  const sb = supabaseAdmin();

  const { data: admin } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const reports = unwrapRows(
    await sb
      .from("reports")
      .select("id, target_user_id, chat_id, reason_code, comment, status, created_at")
      .in("status", OPEN)
      .order("created_at", { ascending: true })
      .limit(100),
  ) as unknown as Report[];

  const targetIds = [...new Set(reports.map((r) => r.target_user_id))];
  const users = targetIds.length
    ? unwrapRows(
        await sb
          .from("users")
          .select("id, telegram_first_name, telegram_username, lifecycle_state")
          .in("id", targetIds),
      )
    : [];
  const userBy: Record<string, { name: string; banned: boolean }> = {};
  for (const u of users)
    userBy[u.id as string] = {
      name:
        (u.telegram_first_name as string) ||
        (u.telegram_username ? "@" + u.telegram_username : (u.id as string).slice(0, 8)),
      banned: u.lifecycle_state === "blocked",
    };
  const countBy: Record<string, number> = {};
  for (const r of reports) countBy[r.target_user_id] = (countBy[r.target_user_id] ?? 0) + 1;

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Жалобы</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {reports.length} открытых · отправитель скрыт
      </p>

      {reports.length === 0 ? (
        <div
          style={{
            padding: 24,
            color: ADMIN.ink500,
            fontSize: 13,
            textAlign: "center",
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
          }}
        >
          Открытых жалоб нет.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: ADMIN.surface,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
              {["Пользователь", "Причина", "Комментарий", "Чат", "Статус", "Создана", "Действия"].map(
                (h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const u = userBy[r.target_user_id];
              const reportCount = countBy[r.target_user_id];
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    <Link
                      href={`/admin/clients/${r.target_user_id}`}
                      style={{ color: ADMIN.ink900, textDecoration: "none" }}
                    >
                      {u?.name ?? r.target_user_id.slice(0, 8)}
                    </Link>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {u?.banned ? <StatusPill kind="banned">заблокирован</StatusPill> : null}
                      {reportCount > 1 ? (
                        <StatusPill kind="warning">жалоб: {reportCount}</StatusPill>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: ADMIN.ink700 }}>
                    {REASON_RU[r.reason_code] ?? r.reason_code}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 13,
                      color: ADMIN.ink500,
                      fontStyle: r.comment ? "italic" : "normal",
                      maxWidth: 280,
                    }}
                  >
                    {r.comment ? `«${r.comment}»` : "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontFamily: ADMIN.fontMono,
                      color: ADMIN.ink500,
                    }}
                  >
                    {r.chat_id ? `${r.chat_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusPill kind={STATUS_KIND[r.status] ?? "new"}>
                      {STATUS_RU[r.status] ?? r.status}
                    </StatusPill>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link
                      href={`/admin/reports/${r.id}`}
                      style={{
                        fontSize: 12,
                        color: ADMIN.accent,
                        textDecoration: "none",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      разобрать →
                    </Link>
                    <ReportActions reportId={r.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </OpsShell>
  );
}
