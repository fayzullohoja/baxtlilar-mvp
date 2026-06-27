import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { loadMyQueue, loadUnassignedQueue } from "@/lib/admin/load-queue";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireAdmin();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const [mine, unassigned] = await Promise.all([
    loadMyQueue(session.adminId),
    loadUnassignedQueue(),
  ]);

  return (
    <OpsShell
      adminName={admin?.login ?? "—"}
      adminRole={session.role}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 500,
          marginBottom: 8,
          color: ADMIN.ink900,
        }}
      >
        Моя очередь
      </h1>
      <p
        style={{
          color: ADMIN.ink500,
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        {mine.length} в работе · {unassigned.length} без владельца
      </p>

      {mine.length === 0 ? (
        <EmptyState unassignedCount={unassigned.length} />
      ) : (
        <CaseTable rows={mine} />
      )}

      {unassigned.length > 0 ? (
        <div style={{ marginTop: 32 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 500,
              marginBottom: 12,
              color: ADMIN.ink700,
            }}
          >
            Без владельца ({unassigned.length})
          </h2>
          <CaseTable rows={unassigned} unassigned />
        </div>
      ) : null}
    </OpsShell>
  );
}

function EmptyState({ unassignedCount }: { unassignedCount: number }) {
  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
        color: ADMIN.ink500,
        fontSize: 13,
      }}
    >
      {unassignedCount === 0
        ? "Очередь пуста. Новых заявок нет."
        : "Очередь пуста. Возьми из «Без владельца» ниже."}
    </div>
  );
}

type Row = {
  case_id: string;
  user_id: string;
  state: string;
  display_name: string | null;
  telegram_first_name: string | null;
  telegram_username: string | null;
  created_at: string;
};

function CaseTable({
  rows,
  unassigned = false,
}: {
  rows: Row[];
  unassigned?: boolean;
}) {
  return (
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
          {["ID", "Клиент", "TG", "Состояние", "Поступило"].map((h) => (
            <th
              key={h}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                fontSize: 11,
                color: ADMIN.ink500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const fallbackName =
            c.display_name ?? c.telegram_first_name ?? "—";
          return (
            <tr
              key={c.case_id}
              style={{ borderBottom: `1px solid ${ADMIN.border}` }}
            >
              <td
                style={{
                  padding: "10px 12px",
                  fontFamily: ADMIN.fontMono,
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                <Link
                  href={`/admin/cases/${c.case_id}`}
                  style={{ color: ADMIN.accent, textDecoration: "none" }}
                >
                  VR-{c.case_id.slice(0, 8)}
                </Link>
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                {fallbackName}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink500,
                }}
              >
                {c.telegram_username ? `@${c.telegram_username}` : "—"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatusPill
                  kind={
                    c.state === "data_entry"
                      ? "warning"
                      : unassigned
                        ? "new"
                        : "pending"
                  }
                >
                  {c.state}
                </StatusPill>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  fontSize: 12,
                  color: ADMIN.ink500,
                }}
              >
                {new Date(c.created_at).toLocaleString("ru-RU")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
