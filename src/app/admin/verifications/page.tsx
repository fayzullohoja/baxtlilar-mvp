import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

const OVERDUE_MS = 24 * 60 * 60 * 1000;

function overdueInfo(iso: string): { overdue: boolean; label: string } {
  const waited = Date.now() - new Date(iso).getTime();
  return { overdue: waited > OVERDUE_MS, label: new Date(iso).toLocaleString("ru-RU") };
}

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

export default async function VerificationsQueue() {
  const session = await requireAdmin();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const list = unwrapRows(
    await supabaseAdmin()
      .from("users")
      .select("id, telegram_username, telegram_first_name, phone_number, updated_at")
      .eq("verification_status", "pending_review")
      .order("updated_at", { ascending: true })
      .limit(100),
  );

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Очередь верификации</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {`${list.length} ${pluralize(list.length, "заявка", "заявки", "заявок")} на проверке`}
      </p>

      {list.length === 0 ? (
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
          Очередь пуста. Возвращайся когда новые заявки прилетят.
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
              {["Пользователь", "Ожидает с", "Статус", ""].map((h, i) => (
                <th
                  key={h || `col-${i}`}
                  style={i === 3 ? { ...th, textAlign: "right" } : th}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const { overdue, label } = overdueInfo(u.updated_at as string);
              const name =
                (u.telegram_first_name as string) ||
                (u.telegram_username ? "@" + u.telegram_username : null) ||
                (u.id as string).slice(0, 8);
              return (
                <tr
                  key={u.id as string}
                  style={{ borderBottom: `1px solid ${ADMIN.border}` }}
                >
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    <Link
                      href={`/admin/verifications/${u.id}`}
                      style={{ color: ADMIN.ink900, textDecoration: "none" }}
                    >
                      {name}
                    </Link>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      color: overdue ? ADMIN.danger : ADMIN.ink500,
                      fontFamily: ADMIN.fontMono,
                    }}
                  >
                    {label}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {overdue ? (
                      <StatusPill kind="rejected">Просрочено &gt; 24ч</StatusPill>
                    ) : (
                      <StatusPill kind="pending">В норме</StatusPill>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link
                      href={`/admin/verifications/${u.id}`}
                      style={{ color: ADMIN.accent, textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                    >
                      Открыть →
                    </Link>
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

function pluralize(n: number, one: string, few: string, many: string): string {
  const m = n % 100;
  if (m >= 11 && m <= 19) return many;
  const u = n % 10;
  if (u === 1) return one;
  if (u >= 2 && u <= 4) return few;
  return many;
}
