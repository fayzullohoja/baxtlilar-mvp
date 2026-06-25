import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { V2AdminShell, AdminH1 } from "@/components/v2/AdminShell";

export const dynamic = "force-dynamic";

/**
 * V2 Admin · Audit Log (Blueprint §4.7).
 * Editorial table — серый монохром, mono-font для action/entity.
 * F-120 RBAC: moderator видит только свои действия; superadmin — все.
 */
export default async function AuditPage() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  let q = sb
    .from("admin_audit_log")
    .select("created_at, action, entity, entity_id, reason, admin_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (session.role !== "superadmin") {
    q = q.eq("admin_id", session.adminId);
  }
  const list = unwrapRows(await q);

  const adminIds = [...new Set(list.map((r) => r.admin_id as string).filter(Boolean))];
  const logins = new Map<string, string>();
  if (adminIds.length) {
    const admins = unwrapRows(
      await sb.from("admin_users").select("id, login").in("id", adminIds),
    );
    for (const a of admins) logins.set(a.id as string, a.login as string);
  }

  const subtitle =
    session.role === "superadmin"
      ? "Последние 100 действий всех модераторов."
      : "Твои последние 100 действий. Чужие — только super-admin.";

  return (
    <V2AdminShell active="/admin/audit" role={session.role}>
      <AdminH1 subtitle={subtitle}>Журнал действий</AdminH1>

      <div
        style={{
          border: "1px solid var(--color-v2-ink-500)",
          borderRadius: "var(--v2-radius-md)",
          overflow: "hidden",
          background: "var(--color-v2-paper)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-v2-body)",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-v2-ink-500)" }}>
              <Th>Когда</Th>
              <Th>Сотрудник</Th>
              <Th>Действие</Th>
              <Th>Объект</Th>
              <Th>Причина</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const adminLogin = logins.get(r.admin_id as string);
              return (
                <tr
                  key={i}
                  style={{ borderTop: "1px solid var(--color-v2-ink-600)" }}
                >
                  <Td>
                    <span style={{ color: "var(--color-v2-ink-400)", whiteSpace: "nowrap" }}>
                      {new Date(r.created_at as string).toLocaleString("ru-RU")}
                    </span>
                  </Td>
                  <Td>{adminLogin ?? "—"}</Td>
                  <Td mono>{r.action as string}</Td>
                  <Td mono>
                    {(r.entity as string)}:{((r.entity_id as string) ?? "").slice(0, 8)}
                  </Td>
                  <Td>
                    <span style={{ color: "var(--color-v2-ink-300)" }}>
                      {(r.reason as string) ?? "—"}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? (
          <p
            style={{
              padding: "32px",
              fontSize: "14px",
              color: "var(--color-v2-ink-400)",
              fontFamily: "var(--font-v2-body)",
              textAlign: "center",
            }}
          >
            Журнал пуст.
          </p>
        ) : null}
      </div>
    </V2AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: "left",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--color-v2-ink-400)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "12px 16px",
        color: "var(--color-v2-ink-100)",
        fontFamily: mono ? "'SF Mono', Menlo, Consolas, monospace" : "var(--font-v2-body)",
        fontSize: mono ? "12px" : "13px",
      }}
    >
      {children}
    </td>
  );
}
