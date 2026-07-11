import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { searchClients } from "@/lib/admin/load-clients-search";
import { ClientsScreen } from "./ClientsScreen";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "Все" },
  { key: "onboarding", label: "Онбординг" },
  { key: "active", label: "Активные" },
  { key: "paused", label: "Пауза" },
  { key: "blocked", label: "Заблокир." },
  { key: "deleted", label: "Удалённые" }, // DZ-4
];
const GENDER_FILTERS = [
  { key: "all", label: "Любой пол" },
  { key: "m", label: "Мужчины" },
  { key: "f", label: "Женщины" },
];
// UL-3: фильтр по стадии верификации (те статусы, что важны модерации).
const VERIFICATION_FILTERS = [
  { key: "all", label: "Любая верификация" },
  { key: "pending_review", label: "На проверке" },
  { key: "approved", label: "Подтверждён" },
  { key: "needs_changes", label: "Доработка" },
  { key: "rejected", label: "Отклонён" },
  { key: "not_started", label: "Не начата" },
];

const PAGE_SIZE = 50;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; gender?: string; verification?: string }>;
}) {
  const session = await requireAdmin();
  // F-120: директория = browse-anyone PII (ПИНФЛ/паспорт/телефон). Super-only,
  // как было /admin/users в проде. Модератор работает из своей очереди.
  if (session.role !== "superadmin") redirect("/admin/queue/mine");

  const sp = await searchParams;
  const statusF = sp.status ?? "all";
  const genderF = sp.gender === "m" || sp.gender === "f" ? sp.gender : "all";
  const verifF = sp.verification ?? "all";

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const filters = { status: statusF, gender: genderF, verification: verifF };
  const { rows, hasMore } = await searchClients("", PAGE_SIZE, filters);

  // href сохраняет ВСЕ активные фильтры, меняя один. Пустые (all) не пишем.
  const hrefWith = (override: Partial<typeof filters>) => {
    const merged = { status: statusF, gender: genderF, verification: verifF, ...override };
    const qs = new URLSearchParams();
    if (merged.status !== "all") qs.set("status", merged.status);
    if (merged.gender !== "all") qs.set("gender", merged.gender);
    if (merged.verification !== "all") qs.set("verification", merged.verification);
    const s = qs.toString();
    return `/admin/clients${s ? `?${s}` : ""}`;
  };
  const anyFilter = statusF !== "all" || genderF !== "all" || verifF !== "all";

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Клиенты</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Поиск по ФИО, ПИНФЛ, паспорту, телефону, @username — фильтры применяются и
        к поиску.
      </p>

      <Pills>
        {STATUS_FILTERS.map((f) => (
          <Pill key={f.key} href={hrefWith({ status: f.key })} active={statusF === f.key}>
            {f.label}
          </Pill>
        ))}
      </Pills>
      <Pills mt={8}>
        {GENDER_FILTERS.map((f) => (
          <Pill key={f.key} href={hrefWith({ gender: f.key })} active={genderF === f.key}>
            {f.label}
          </Pill>
        ))}
      </Pills>
      <Pills mt={8}>
        {VERIFICATION_FILTERS.map((f) => (
          <Pill
            key={f.key}
            href={hrefWith({ verification: f.key })}
            active={verifF === f.key}
          >
            {f.label}
          </Pill>
        ))}
      </Pills>

      <div style={{ marginTop: 20 }}>
        <ClientsScreen
          key={`${statusF}|${genderF}|${verifF}`}
          initial={rows}
          hasMore={hasMore}
          filters={filters}
          filtered={anyFilter}
        />
      </div>
    </OpsShell>
  );
}

function Pills({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: mt }}>
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
        padding: "5px 12px",
        fontSize: 13,
        fontFamily: ADMIN.fontSans,
        color: active ? "#fff" : ADMIN.ink700,
        background: active ? ADMIN.accent : ADMIN.surface,
        border: `1px solid ${active ? ADMIN.accent : ADMIN.border}`,
        borderRadius: 6,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
