import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { V2AdminShell, AdminH1 } from "@/components/v2/AdminShell";
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
  { key: "m", label: "Мужчины" },
  { key: "f", label: "Женщины" },
];

type ProfileEmbed = { gender: string | null; birth_date: string | null; city: string | null };
type UserRow = {
  id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  lifecycle_state: string;
  verification_status: string;
  created_at: string;
};

/**
 * V2 Admin · Users (Blueprint §4.6).
 * Editorial table + filter pills. F-120 RBAC: moderator видит только
 * pending_review-онбординг — фильтры status игнорируются для moderator.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; gender?: string }>;
}) {
  const session = await requireAdmin();
  const { status, gender } = await searchParams;
  const statusF = status ?? "all";
  const genderF = gender === "m" || gender === "f" ? gender : "all";
  const sb = supabaseAdmin();

  let genderIds: string[] | null = null;
  if (genderF !== "all") {
    genderIds = unwrapRows(
      await sb.from("user_profiles").select("user_id").eq("gender", genderF),
    ).map((r) => r.user_id as string);
  }

  let list: UserRow[] = [];
  if (genderF === "all" || (genderIds && genderIds.length)) {
    let q = sb
      .from("users")
      .select(
        "id, telegram_username, telegram_first_name, lifecycle_state, verification_status, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (session.role === "moderator") {
      q = q.eq("verification_status", "pending_review").eq("lifecycle_state", "onboarding");
    } else if (statusF !== "all") {
      q = q.eq("lifecycle_state", statusF);
    }
    if (genderIds) q = q.in("id", genderIds);
    list = unwrapRows(await q) as unknown as UserRow[];
  }

  const profiles = new Map<string, ProfileEmbed>();
  const ids = list.map((u) => u.id);
  if (ids.length) {
    const ups = unwrapRows(
      await sb.from("user_profiles").select("user_id, gender, birth_date, city").in("user_id", ids),
    );
    for (const p of ups) profiles.set(p.user_id as string, p as ProfileEmbed);
  }

  const hrefStatus = (k: string) =>
    `/admin/users?status=${k}${genderF !== "all" ? `&gender=${genderF}` : ""}`;
  const hrefGender = (k: string) =>
    `/admin/users?gender=${k}${statusF !== "all" ? `&status=${statusF}` : ""}`;

  return (
    <V2AdminShell active="/admin/users" role={session.role}>
      <AdminH1
        subtitle={
          session.role === "moderator"
            ? "Только пользователи в очереди модерации (F-120 RBAC scope)."
            : `${list.length} пользователей в выборке.`
        }
      >
        Пользователи
      </AdminH1>

      {/* Filter pills */}
      {session.role !== "moderator" ? (
        <>
          <FilterPills>
            {STATUS_FILTERS.map((f) => (
              <Pill key={f.key} href={hrefStatus(f.key)} active={statusF === f.key}>
                {f.label}
              </Pill>
            ))}
          </FilterPills>
          <FilterPills mt={12}>
            {GENDER_FILTERS.map((f) => (
              <Pill key={f.key} href={hrefGender(f.key)} active={genderF === f.key}>
                {f.label}
              </Pill>
            ))}
          </FilterPills>
        </>
      ) : null}

      {/* Table */}
      <div
        style={{
          marginTop: "32px",
          border: "1px solid var(--color-v2-ink-500)",
          borderRadius: "var(--v2-radius-md)",
          overflow: "auto",
          background: "var(--color-v2-paper)",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "760px",
            borderCollapse: "collapse",
            fontFamily: "var(--font-v2-body)",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-v2-ink-500)" }}>
              <Th>Пользователь</Th>
              <Th>Пол</Th>
              <Th>Возраст</Th>
              <Th>Город</Th>
              <Th>Статус</Th>
              <Th>Верификация</Th>
              <Th>Регистрация</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const p = profiles.get(u.id) ?? null;
              const age = p?.birth_date ? ageFromDate(p.birth_date) : null;
              return (
                <tr
                  key={u.id as string}
                  style={{ borderTop: "1px solid var(--color-v2-ink-600)" }}
                >
                  <Td>
                    {(u.telegram_first_name as string) ||
                      (u.telegram_username
                        ? "@" + u.telegram_username
                        : (u.id as string).slice(0, 8))}
                  </Td>
                  <Td muted>{genderRu(p?.gender)}</Td>
                  <Td muted>{age && age > 0 ? age : "—"}</Td>
                  <Td muted>{p?.city ? cityLabel(p.city, "ru") : "—"}</Td>
                  <Td muted>{lifecycleRu(u.lifecycle_state)}</Td>
                  <Td muted>{verificationRu(u.verification_status)}</Td>
                  <Td muted>{new Date(u.created_at as string).toLocaleDateString("ru-RU")}</Td>
                  <Td align="right">
                    <UserActions userId={u.id as string} blocked={u.lifecycle_state === "blocked"} />
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
            Нет пользователей в этой выборке.
          </p>
        ) : null}
      </div>
    </V2AdminShell>
  );
}

function FilterPills({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: mt + "px",
      }}
    >
      {children}
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 14px",
        fontSize: "13px",
        fontFamily: "var(--font-v2-body)",
        color: active ? "var(--color-v2-paper)" : "var(--color-v2-ink-200)",
        background: active ? "var(--color-v2-ink-100)" : "transparent",
        border: `1px solid ${active ? "var(--color-v2-ink-100)" : "var(--color-v2-ink-500)"}`,
        borderRadius: "999px",
        textDecoration: "none",
        transition: "all 0.12s ease",
      }}
    >
      {children}
    </Link>
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

function Td({
  children,
  muted,
  align = "left",
}: {
  children: React.ReactNode;
  muted?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        textAlign: align,
        color: muted ? "var(--color-v2-ink-300)" : "var(--color-v2-ink-100)",
        fontFamily: "var(--font-v2-body)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
