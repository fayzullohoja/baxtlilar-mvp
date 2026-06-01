import Link from "next/link";
import { LogoutButton } from "./logout-button";

const NAV = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/verifications", label: "Верификация" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/audit", label: "Журнал" },
];

/** Оболочка авторизованных страниц админки: сайдбар + контент. */
export function AdminShell({
  children,
  active,
  role,
}: {
  children: React.ReactNode;
  active: string;
  role?: string;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="font-bold text-white">Baxtlilar</div>
          <div className="text-xs text-slate-400">Админ-панель</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                "block px-5 py-2.5 text-sm " +
                (active === n.href
                  ? "bg-slate-800 text-white border-l-2 border-baxt-coral"
                  : "text-slate-300 hover:bg-slate-800")
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-400">
          <div className="mb-2">Роль: {role ?? "—"}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
