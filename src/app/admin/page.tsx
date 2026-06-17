import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapCount, unwrapOne } from "@/lib/db/unwrap";
import { AdminShell } from "@/components/admin/shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  // Те же числа, что и на странице «Демография» — единый RPC (исключает удалённых пользователей).
  const [pending, photos, demo, reports] = await Promise.all([
    sb.from("users").select("*", { count: "exact", head: true }).eq("verification_status", "pending_review"),
    sb.from("profile_photos").select("*", { count: "exact", head: true }).eq("status", "under_review"),
    sb.rpc("get_admin_demographics"),
    sb.from("reports").select("*", { count: "exact", head: true }).in("status", ["new", "in_progress", "requires_clarification", "escalated"]),
  ]);
  // unwrap* бросают на сбое БД (видимая ошибка) вместо тихих нулей/«нет данных»:
  // ложный «0 заявок на проверке» прячет реальный бэклог модерации.
  const pendingCount = unwrapCount(pending);
  const photosCount = unwrapCount(photos);
  const reportsCount = unwrapCount(reports);
  const d = (unwrapOne(demo) ?? {}) as {
    total?: number;
    gender?: { m: number; f: number };
    lifecycle?: Record<string, number>;
  };

  const cards = [
    { label: "Заявки на проверке", value: pendingCount, href: "/admin/verifications", accent: true },
    { label: "Фото на проверке", value: photosCount, href: "/admin/photos", accent: photosCount > 0 },
    { label: "Жалобы", value: reportsCount, href: "/admin/reports", accent: reportsCount > 0 },
    { label: "Всего пользователей", value: d.total ?? 0, href: "/admin/users" },
    { label: "Активных", value: d.lifecycle?.active ?? 0, href: "/admin/users?status=active" },
    { label: "Заблокировано", value: d.lifecycle?.blocked ?? 0, href: "/admin/users?status=blocked" },
    { label: "♂ Мужчин", value: d.gender?.m ?? 0, href: "/admin/users?gender=m" },
    { label: "♀ Женщин", value: d.gender?.f ?? 0, href: "/admin/users?gender=f" },
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
