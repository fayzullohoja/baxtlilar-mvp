import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

const OVERDUE_MS = 24 * 60 * 60 * 1000;

/** Вынесено из рендера: react-hooks/purity не любит Date.now() в компоненте. */
function overdueInfo(iso: string): { overdue: boolean; label: string } {
  const waited = Date.now() - new Date(iso).getTime();
  return { overdue: waited > OVERDUE_MS, label: new Date(iso).toLocaleString("ru-RU") };
}

export default async function VerificationsQueue() {
  const session = await requireAdmin();
  // unwrapRows бросает на сбое БД — иначе ошибка маскируется под «Очередь пуста»,
  // и заявки на верификацию зависают незамеченными.
  const list = unwrapRows(
    await supabaseAdmin()
      .from("users")
      .select("id, telegram_username, telegram_first_name, phone_number, updated_at")
      .eq("verification_status", "pending_review")
      .order("updated_at", { ascending: true })
      .limit(100),
  );

  return (
    <AdminShell active="/admin/verifications" role={session.role}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Очередь верификации</h1>
      <p className="text-sm text-slate-500 mb-6">{list.length} заявок на проверке</p>

      {list.length === 0 ? (
        <p className="text-slate-400">Очередь пуста.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Пользователь</th>
                <th className="px-4 py-3 font-medium">Ожидает с</th>
                <th className="px-4 py-3 font-medium">Статус ожидания</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const { overdue, label: waitedLabel } = overdueInfo(u.updated_at as string);
                const name =
                  (u.telegram_first_name as string) ||
                  (u.telegram_username ? "@" + u.telegram_username : null) ||
                  (u.id as string).slice(0, 8);
                return (
                  <tr key={u.id as string} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{name}</td>
                    <td className="px-4 py-3 text-slate-500">{waitedLabel}</td>
                    <td className="px-4 py-3">
                      {overdue ? (
                        <span className="text-red-600 font-medium">⚠ Просрочено &gt;24ч</span>
                      ) : (
                        <span className="text-slate-400">в норме</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/verifications/${u.id}`}
                        className="text-baxt-coral hover:underline font-medium"
                      >
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
