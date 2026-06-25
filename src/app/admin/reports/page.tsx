import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { V2AdminShell, AdminH1 } from "@/components/v2/AdminShell";
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

type Report = {
  id: string;
  target_user_id: string;
  chat_id: string | null;
  reason_code: string;
  comment: string | null;
  status: string;
  created_at: string;
};

/**
 * V2 Admin · Reports (Blueprint §4.5).
 *
 * Editorial list cards: serif target name, soft-tag статус, count-badge
 * только если >1. Super-admin only (F-120).
 */
export default async function ReportsModeration() {
  const session = await requireAdmin();
  if (session.role !== "superadmin") notFound();
  const sb = supabaseAdmin();

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
    <V2AdminShell active="/admin/reports" role={session.role}>
      <AdminH1 subtitle={`${reports.length} открытых · отправитель скрыт.`}>
        Жалобы
      </AdminH1>

      {reports.length === 0 ? (
        <p
          style={{
            fontSize: "15px",
            color: "var(--color-v2-ink-400)",
            fontFamily: "var(--font-v2-body)",
            padding: "60px 0",
            textAlign: "center",
          }}
        >
          Открытых жалоб нет. Хороший день у юзеров.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {reports.map((r) => {
            const u = userBy[r.target_user_id];
            const reportCount = countBy[r.target_user_id];
            return (
              <li
                key={r.id}
                style={{
                  background: "var(--color-v2-paper)",
                  border: "1px solid var(--color-v2-ink-500)",
                  borderRadius: "var(--v2-radius-md)",
                  padding: "20px",
                  fontFamily: "var(--font-v2-body)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <Link
                    href="/admin/users"
                    style={{
                      fontFamily: "var(--font-v2-display)",
                      fontSize: "18px",
                      color: "var(--color-v2-ink-100)",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    {u?.name ?? r.target_user_id.slice(0, 8)}
                  </Link>
                  {u?.banned ? (
                    <span style={{ fontSize: "11px", color: "#b8475e", fontWeight: 500 }}>
                      заблокирован
                    </span>
                  ) : null}
                  {reportCount > 1 ? (
                    <span
                      style={{
                        padding: "2px 10px",
                        background: "var(--color-v2-ink-100)",
                        color: "var(--color-v2-paper)",
                        fontSize: "11px",
                        borderRadius: "999px",
                        fontWeight: 500,
                      }}
                    >
                      жалоб: {reportCount}
                    </span>
                  ) : null}
                  <span
                    style={{
                      padding: "2px 10px",
                      background: "transparent",
                      border: "1px solid var(--color-v2-ink-500)",
                      color: "var(--color-v2-ink-300)",
                      fontSize: "11px",
                      borderRadius: "999px",
                    }}
                  >
                    {STATUS_RU[r.status] ?? r.status}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "11px",
                      color: "var(--color-v2-ink-400)",
                    }}
                  >
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "var(--color-v2-ink-200)",
                    marginBottom: r.comment ? "6px" : "12px",
                  }}
                >
                  {REASON_RU[r.reason_code] ?? r.reason_code}
                </div>
                {r.comment ? (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-v2-ink-400)",
                      fontStyle: "italic",
                      marginBottom: "12px",
                      lineHeight: "1.55",
                    }}
                  >
                    «{r.comment}»
                  </p>
                ) : null}
                {r.chat_id ? (
                  <p style={{ fontSize: "11px", color: "var(--color-v2-ink-400)", marginBottom: "12px" }}>
                    чат: {r.chat_id.slice(0, 8)}…
                  </p>
                ) : null}
                <ReportActions reportId={r.id} />
              </li>
            );
          })}
        </ul>
      )}
    </V2AdminShell>
  );
}
