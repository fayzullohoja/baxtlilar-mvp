import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { AdminShell } from "@/components/admin/shell";
import { ReportActions } from "@/components/admin/report-actions";

export const dynamic = "force-dynamic";

const OPEN = ["new", "in_progress", "requires_clarification", "escalated"];
const REASON_RU: Record<string, string> = {
  fake: "Фейковый профиль",
  offensive: "Оскорбления",
  contacts: "Навязывает контакты",
  spam: "Спам",
  inappropriate: "Неприемлемо",
  other: "Другое",
};
const STATUS_RU: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  requires_clarification: "Нужны уточнения",
  escalated: "Эскалация",
};

type Report = {
  id: string;
  target_user_id: string;
  chat_id: string | null;
  reason_code: string;
  comment: string | null;
  status: string;
  created_at: string;
};

export default async function ReportsModeration() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  // unwrapRows бросает на сбое БД — иначе пустой список выглядит как «жалоб нет».
  const reports = unwrapRows(
    await sb
      .from("reports")
      .select("id, target_user_id, chat_id, reason_code, comment, status, created_at")
      .in("status", OPEN)
      .order("created_at", { ascending: true })
      .limit(100),
  ) as unknown as Report[];

  const targetIds = [...new Set(reports.map((r) => r.target_user_id))];
  const users = targetIds.length
    ? unwrapRows(
        await sb
          .from("users")
          .select("id, telegram_first_name, telegram_username, lifecycle_state")
          .in("id", targetIds),
      )
    : [];
  const userBy: Record<string, { name: string; banned: boolean }> = {};
  for (const u of users)
    userBy[u.id as string] = {
      name:
        (u.telegram_first_name as string) ||
        (u.telegram_username ? "@" + u.telegram_username : (u.id as string).slice(0, 8)),
      banned: u.lifecycle_state === "blocked",
    };
  // сколько ОТКРЫТЫХ жалоб на каждого (для приоритета)
  const countBy: Record<string, number> = {};
  for (const r of reports) countBy[r.target_user_id] = (countBy[r.target_user_id] ?? 0) + 1;

  return (
    <AdminShell active="/admin/reports" role={session.role}>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Жалобы</h1>
      <p className="mb-6 text-sm text-slate-500">{reports.length} открытых · отправитель скрыт</p>

      {reports.length === 0 ? (
        <p className="text-slate-400">Открытых жалоб нет.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const u = userBy[r.target_user_id];
            return (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href="/admin/users" className="font-semibold text-slate-900 hover:underline">
                    {u?.name ?? r.target_user_id.slice(0, 8)}
                  </Link>
                  {u?.banned ? <span className="text-xs text-red-600">заблокирован</span> : null}
                  {countBy[r.target_user_id] > 1 ? (
                    <span className="rounded-full bg-baxt-coral px-2 text-xs text-white">
                      жалоб: {countBy[r.target_user_id]}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">
                    {STATUS_RU[r.status] ?? r.status}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="mb-1 text-sm text-slate-700">{REASON_RU[r.reason_code] ?? r.reason_code}</div>
                {r.comment ? <p className="mb-2 text-sm text-slate-500">«{r.comment}»</p> : null}
                {r.chat_id ? <p className="mb-2 text-xs text-slate-400">чат: {r.chat_id.slice(0, 8)}…</p> : null}
                <ReportActions reportId={r.id} />
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
