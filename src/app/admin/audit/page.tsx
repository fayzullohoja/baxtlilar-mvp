import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

/**
 * Admin · Audit Log.
 * Dense ops table — mono-font для timestamp/action/entity.
 * F-120 RBAC: moderator видит только свои действия; superadmin — все.
 */
export default async function AuditPage() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  const { data: admin } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

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
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Журнал действий</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>{subtitle}</p>

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
          Журнал пуст.
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
              {["Когда", "Сотрудник", "Действие", "Объект", "Причина"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const adminLogin = logins.get(r.admin_id as string);
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontFamily: ADMIN.fontMono,
                      color: ADMIN.ink500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(r.created_at as string).toLocaleString("ru-RU")}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: ADMIN.ink900 }}>
                    {adminLogin ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontFamily: ADMIN.fontMono,
                      color: ADMIN.ink900,
                    }}
                  >
                    {r.action as string}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      fontFamily: ADMIN.fontMono,
                      color: ADMIN.ink700,
                    }}
                  >
                    {r.entity as string}:{((r.entity_id as string) ?? "").slice(0, 8)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: ADMIN.ink500 }}>
                    {(r.reason as string) ?? "—"}
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

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};
