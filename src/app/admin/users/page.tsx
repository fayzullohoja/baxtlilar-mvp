import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";
import { UserActions } from "@/components/admin/user-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "onboarding", label: "Онбординг" },
  { key: "active", label: "Активные" },
  { key: "blocked", label: "Заблокир." },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAdmin();
  const { status } = await searchParams;
  const filter = status ?? "all";

  let q = supabaseAdmin()
    .from("users")
    .select("id, telegram_username, telegram_first_name, lifecycle_state, verification_status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") q = q.eq("lifecycle_state", filter);
  const { data: rows } = await q;
  const list = rows ?? [];

  return (
    <AdminShell active="/admin/users" role={session.role}>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Пользователи</h1>
      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/users?status=${f.key}`}
            className={
              "px-3 py-1.5 rounded-full text-sm " +
              (filter === f.key ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Верификация</th>
              <th className="px-4 py-3 font-medium">Регистрация</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id as string} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">
                  {(u.telegram_first_name as string) ||
                    (u.telegram_username ? "@" + u.telegram_username : (u.id as string).slice(0, 8))}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.lifecycle_state as string}</td>
                <td className="px-4 py-3 text-slate-600">{u.verification_status as string}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(u.created_at as string).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3 text-right">
                  <UserActions userId={u.id as string} blocked={u.lifecycle_state === "blocked"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 ? <p className="p-6 text-slate-400 text-sm">Нет пользователей.</p> : null}
      </div>
    </AdminShell>
  );
}
