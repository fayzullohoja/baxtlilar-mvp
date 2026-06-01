import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  const [pending, totalUsers, active, blocked] = await Promise.all([
    sb.from("users").select("*", { count: "exact", head: true }).eq("verification_status", "pending_review"),
    sb.from("users").select("*", { count: "exact", head: true }),
    sb.from("users").select("*", { count: "exact", head: true }).eq("lifecycle_state", "active"),
    sb.from("users").select("*", { count: "exact", head: true }).eq("lifecycle_state", "blocked"),
  ]);

  const cards = [
    { label: "Заявки на проверке", value: pending.count ?? 0, href: "/admin/verifications", accent: true },
    { label: "Всего пользователей", value: totalUsers.count ?? 0, href: "/admin/users" },
    { label: "Активных", value: active.count ?? 0, href: "/admin/users" },
    { label: "Заблокировано", value: blocked.count ?? 0, href: "/admin/users" },
  ];

  return (
    <AdminShell active="/admin" role={session.role}>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Дашборд</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={
              "rounded-xl border p-5 bg-white hover:shadow-sm transition " +
              (c.accent ? "border-baxt-coral/40" : "border-slate-200")
            }
          >
            <div className={"text-3xl font-bold " + (c.accent ? "text-baxt-coral" : "text-slate-900")}>
              {c.value}
            </div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
