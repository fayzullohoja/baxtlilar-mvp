import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";
import { UserActions } from "@/components/admin/user-actions";
import { ageFromDate } from "@/lib/profile/schemas";
import { cityLabel } from "@/lib/profile/cities";
import { lifecycleRu, verificationRu, genderRu } from "@/lib/admin/labels";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "Все" },
  { key: "onboarding", label: "Онбординг" },
  { key: "active", label: "Активные" },
  { key: "blocked", label: "Заблокир." },
];
const GENDER_FILTERS = [
  { key: "all", label: "Любой пол" },
  { key: "m", label: "♂ Мужчины" },
  { key: "f", label: "♀ Женщины" },
];

type ProfileEmbed = { gender: string | null; birth_date: string | null; city: string | null };
type UserRow = {
  id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  lifecycle_state: string;
  verification_status: string;
  created_at: string;
  user_profiles?: ProfileEmbed | ProfileEmbed[] | null;
};
function pickProfile(v: unknown): ProfileEmbed | null {
  if (Array.isArray(v)) return (v[0] as ProfileEmbed) ?? null;
  return (v as ProfileEmbed) ?? null;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; gender?: string }>;
}) {
  const session = await requireAdmin();
  const { status, gender } = await searchParams;
  const statusF = status ?? "all";
  const genderF = gender === "m" || gender === "f" ? gender : "all";

  const sel =
    "id, telegram_username, telegram_first_name, lifecycle_state, verification_status, created_at, " +
    (genderF === "all"
      ? "user_profiles(gender, birth_date, city)"
      : "user_profiles!inner(gender, birth_date, city)");

  let q = supabaseAdmin()
    .from("users")
    .select(sel)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (statusF !== "all") q = q.eq("lifecycle_state", statusF);
  if (genderF !== "all") q = q.eq("user_profiles.gender", genderF);
  const { data: rows } = await q;
  const list = (rows ?? []) as unknown as UserRow[];

  // ссылки фильтров сохраняют второй параметр
  const hrefStatus = (k: string) => `/admin/users?status=${k}${genderF !== "all" ? `&gender=${genderF}` : ""}`;
  const hrefGender = (k: string) => `/admin/users?gender=${k}${statusF !== "all" ? `&status=${statusF}` : ""}`;

  return (
    <AdminShell active="/admin/users" role={session.role}>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Пользователи</h1>

      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={hrefStatus(f.key)}
            className={
              "rounded-full px-3 py-1.5 text-sm " +
              (statusF === f.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {GENDER_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={hrefGender(f.key)}
            className={
              "rounded-full px-3 py-1.5 text-sm " +
              (genderF === f.key ? "bg-baxt-coral text-white" : "border border-slate-200 bg-white text-slate-600")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Пользователь</th>
              <th className="px-4 py-3 font-medium">Пол</th>
              <th className="px-4 py-3 font-medium">Возраст</th>
              <th className="px-4 py-3 font-medium">Город</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Верификация</th>
              <th className="px-4 py-3 font-medium">Регистрация</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const p = pickProfile((u as { user_profiles?: unknown }).user_profiles);
              const age = p?.birth_date ? ageFromDate(p.birth_date) : null;
              return (
                <tr key={u.id as string} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">
                    {(u.telegram_first_name as string) ||
                      (u.telegram_username ? "@" + u.telegram_username : (u.id as string).slice(0, 8))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{genderRu(p?.gender)}</td>
                  <td className="px-4 py-3 text-slate-600">{age && age > 0 ? age : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p?.city ? cityLabel(p.city, "ru") : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{lifecycleRu(u.lifecycle_state)}</td>
                  <td className="px-4 py-3 text-slate-600">{verificationRu(u.verification_status)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.created_at as string).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <UserActions userId={u.id as string} blocked={u.lifecycle_state === "blocked"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? <p className="p-6 text-sm text-slate-400">Нет пользователей.</p> : null}
      </div>
    </AdminShell>
  );
}
