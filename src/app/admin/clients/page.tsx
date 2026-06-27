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
];
const GENDER_FILTERS = [
  { key: "all", label: "Любой пол" },
  { key: "m", label: "Мужчины" },
  { key: "f", label: "Женщины" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; gender?: string }>;
}) {
  const session = await requireAdmin();
  // F-120: директория = browse-anyone PII (ПИНФЛ/паспорт/телефон). Super-only,
  // как было /admin/users в проде. Модератор работает из своей очереди.
  if (session.role !== "superadmin") redirect("/admin/queue/mine");

  const sp = await searchParams;
  const statusF = sp.status ?? "all";
  const genderF = sp.gender === "m" || sp.gender === "f" ? sp.gender : "all";

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const { rows } = await searchClients("", 50, {
    status: statusF,
    gender: genderF,
  });

  const hrefStatus = (k: string) =>
    `/admin/clients?status=${k}${genderF !== "all" ? `&gender=${genderF}` : ""}`;
  const hrefGender = (k: string) =>
    `/admin/clients?gender=${k}${statusF !== "all" ? `&status=${statusF}` : ""}`;

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Клиенты</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Поиск по ФИО, ПИНФЛ, паспорту, телефону, @username — или фильтры ниже.
      </p>

      <Pills>
        {STATUS_FILTERS.map((f) => (
          <Pill key={f.key} href={hrefStatus(f.key)} active={statusF === f.key}>
            {f.label}
          </Pill>
        ))}
      </Pills>
      <Pills mt={8}>
        {GENDER_FILTERS.map((f) => (
          <Pill key={f.key} href={hrefGender(f.key)} active={genderF === f.key}>
            {f.label}
          </Pill>
        ))}
      </Pills>

      <div style={{ marginTop: 20 }}>
        <ClientsScreen
          initial={rows}
          filtered={statusF !== "all" || genderF !== "all"}
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
