import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await requireAdmin();

  const { data: rows } = await supabaseAdmin()
    .from("admin_audit_log")
    .select("created_at, action, entity, entity_id, reason, admin_id, admin_users(login)")
    .order("created_at", { ascending: false })
    .limit(100);
  const list = rows ?? [];

  return (
    <AdminShell active="/admin/audit" role={session.role}>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Журнал действий</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Когда</th>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Действие</th>
              <th className="px-4 py-3 font-medium">Объект</th>
              <th className="px-4 py-3 font-medium">Причина</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const admin = r.admin_users as { login?: string } | null;
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(r.created_at as string).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{admin?.login ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-800 font-mono text-xs">{r.action as string}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {(r.entity as string)}:{((r.entity_id as string) ?? "").slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{(r.reason as string) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? <p className="p-6 text-slate-400 text-sm">Журнал пуст.</p> : null}
      </div>
    </AdminShell>
  );
}
