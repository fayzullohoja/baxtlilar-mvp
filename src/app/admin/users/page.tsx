import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapRows } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { UserActions } from "@/components/admin/user-actions";
import { ageFromDate } from "@/lib/profile/schemas";
import { cityLabel } from "@/lib/profile/cities";
import { lifecycleRu, verificationRu, genderRu } from "@/lib/admin/labels";
import { ADMIN } from "@/lib/admin/admin-tokens";
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

type Pill = "verified" | "pending" | "rejected" | "banned" | "paused" | "active" | "new" | "warning";

const LIFECYCLE_KIND: Record<string, Pill> = {
  onboarding: "new",
  active: "active",
  paused: "paused",
  blocked: "banned",
  deleted: "rejected",
};
const VERIFICATION_KIND: Record<string, Pill> = {
  approved: "verified",
  pending_review: "pending",
  needs_changes: "warning",
  rejected: "rejected",
  revoked: "rejected",
};

type ProfileEmbed = { gender: string | null; birth_date: string | null; city: string | null };
type UserRow = {
  id: string;
  telegram_username: string | null;
  telegram_first_name: string | null;
  lifecycle_state: string;
  verification_status: string;
  created_at: string;
};

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

/**
 * Admin · Users (OpsShell). Editorial table → dense OpsShell table + filter
 * pills. F-120 RBAC: moderator видит только pending_review-онбординг —
 * фильтры status игнорируются для moderator.
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

  const { data: admin } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

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
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Пользователи</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        {session.role === "moderator"
          ? "Только пользователи в очереди модерации (F-120 RBAC scope)."
          : `${list.length} пользователей в выборке.`}
      </p>

      {/* Filter pills */}
      {session.role !== "moderator" ? (
        <>
          <FilterPills>
            {STATUS_FILTERS.map((f) => (
              <FilterPill key={f.key} href={hrefStatus(f.key)} active={statusF === f.key}>
                {f.label}
              </FilterPill>
            ))}
          </FilterPills>
          <FilterPills mt={8}>
            {GENDER_FILTERS.map((f) => (
              <FilterPill key={f.key} href={hrefGender(f.key)} active={genderF === f.key}>
                {f.label}
              </FilterPill>
            ))}
          </FilterPills>
        </>
      ) : null}

      {/* Table */}
      {list.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            padding: 24,
            color: ADMIN.ink500,
            fontSize: 13,
            textAlign: "center",
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
          }}
        >
          Нет пользователей в этой выборке.
        </div>
      ) : (
        <div style={{ marginTop: 24, overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 760,
              borderCollapse: "collapse",
              background: ADMIN.surface,
              border: `1px solid ${ADMIN.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                {["Пользователь", "Пол", "Возраст", "Город", "Статус", "Верификация", "Регистрация", ""].map(
                  (h, i) => (
                    <th key={i} style={th}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const p = profiles.get(u.id) ?? null;
                const age = p?.birth_date ? ageFromDate(p.birth_date) : null;
                const lifeKind = LIFECYCLE_KIND[u.lifecycle_state];
                const verKind = VERIFICATION_KIND[u.verification_status];
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: ADMIN.ink900, whiteSpace: "nowrap" }}>
                      {u.telegram_first_name ||
                        (u.telegram_username ? "@" + u.telegram_username : u.id.slice(0, 8))}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink700 }}>
                      {genderRu(p?.gender)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink700 }}>
                      {age && age > 0 ? age : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink700 }}>
                      {p?.city ? cityLabel(p.city, "ru") : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {lifeKind ? (
                        <StatusPill kind={lifeKind}>{lifecycleRu(u.lifecycle_state)}</StatusPill>
                      ) : (
                        <span style={{ fontSize: 12, color: ADMIN.ink500 }}>
                          {lifecycleRu(u.lifecycle_state)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {verKind ? (
                        <StatusPill kind={verKind}>{verificationRu(u.verification_status)}</StatusPill>
                      ) : (
                        <span style={{ fontSize: 12, color: ADMIN.ink500 }}>
                          {verificationRu(u.verification_status)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <UserActions userId={u.id} blocked={u.lifecycle_state === "blocked"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </OpsShell>
  );
}

function FilterPills({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: mt }}>{children}</div>
  );
}

function FilterPill({
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
        padding: "5px 12px",
        fontSize: 13,
        fontFamily: ADMIN.fontSans,
        color: active ? "#ffffff" : ADMIN.ink700,
        background: active ? ADMIN.accent : ADMIN.surface,
        border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
        borderRadius: 6,
        textDecoration: "none",
        transition: "background 0.12s ease",
      }}
    >
      {children}
    </Link>
  );
}
