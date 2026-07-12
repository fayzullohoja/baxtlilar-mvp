import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapCount, unwrapOne } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";

export const dynamic = "force-dynamic";

/**
 * Admin Dashboard — OpsShell design system.
 *
 * Moderation-queue + population + demographics counters as admin-ops stat
 * cards, grouped under small section labels. Cards with work pending (> 0)
 * get an accent left border so the moderator sees «есть работа».
 */
export default async function AdminDashboard() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();
  // Демография/население = analytics-данные (тот же RPC, что /admin/analytics —
  // super-only). Модератору не показываем И не зовём RPC (иначе дашборд обходит
  // hardening analytics.view — модератор 404'ится из /analytics, но видит те же
  // агрегаты тут). SLA-секция остаётся всем (это moderation-ops, не демография).
  const showPopulation = can(session.role, "analytics.view");

  const { data: admin } = await sb
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const [pending, photos, demo, reports, health] = await Promise.all([
    // VF-1: считаем ОТКРЫТЫЕ кейсы, а не users.pending_review. Иначе счётчик
    // (per-user) расходится с очередью (per-case): pending_review без кейса даёт
    // фантомную работу — число есть, а в очереди пусто. Теперь оба читают
    // verification_cases → заголовочное число == то, что реально открывается.
    sb
      .from("verification_cases")
      .select("*", { count: "exact", head: true })
      .neq("state", "closed"),
    sb
      .from("profile_photos")
      .select("*", { count: "exact", head: true })
      .eq("status", "under_review"),
    showPopulation
      ? sb.rpc("get_admin_demographics")
      : Promise.resolve({ data: null, error: null }),
    sb
      .from("reports")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "in_progress", "requires_clarification", "escalated"]),
    sb.rpc("get_queue_health"), // QZ-7: SLA / aging
  ]);

  const pendingCount = unwrapCount(pending);
  const photosCount = unwrapCount(photos);
  const reportsCount = unwrapCount(reports);
  const d = (unwrapOne(demo) ?? {}) as {
    total?: number;
    gender?: { m: number; f: number };
    lifecycle?: Record<string, number>;
  };
  const h = (unwrapOne(health) ?? {}) as {
    open_total?: number;
    unassigned?: number;
    oldest_open_hours?: number;
    over_24h?: number;
    over_72h?: number;
    photos_over_24h?: number;
  };
  const oldestH = Number(h.oldest_open_hours ?? 0);
  const oldestLabel =
    oldestH >= 24 ? `${Math.floor(oldestH / 24)} дн` : `${Math.round(oldestH)} ч`;

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Дашборд</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        Сегодняшняя работа модерации и общее население платформы.
      </p>

      <Section label="Очередь модерации">
        <Grid>
          <StatCard
            href="/admin/queue/mine"
            label="Заявки на проверке"
            value={pendingCount}
            accent={pendingCount > 0}
          />
          <StatCard
            href="/admin/photos"
            label="Фото на проверке"
            value={photosCount}
            accent={photosCount > 0}
          />
          <StatCard
            href="/admin/reports"
            label="Жалобы открытые"
            value={reportsCount}
            accent={reportsCount > 0}
          />
        </Grid>
      </Section>

      <Section label="Требуют внимания (SLA)">
        <Grid>
          <StatCard
            href="/admin/queue/mine?view=all"
            label="Старейший кейс в очереди"
            value={h.open_total ? oldestLabel : "—"}
            accent={oldestH >= 24}
          />
          <StatCard
            href="/admin/queue/mine?view=all"
            label="Кейсов > 24 ч"
            value={h.over_24h ?? 0}
            accent={(h.over_24h ?? 0) > 0}
          />
          <StatCard
            href="/admin/queue/mine?view=all"
            label="Кейсов > 72 ч"
            value={h.over_72h ?? 0}
            accent={(h.over_72h ?? 0) > 0}
          />
          <StatCard
            href="/admin/queue/mine?view=all"
            label="Без владельца"
            value={h.unassigned ?? 0}
            accent={(h.unassigned ?? 0) > 0}
          />
          <StatCard
            href="/admin/photos?tab=overdue"
            label="Фото > 24 ч"
            value={h.photos_over_24h ?? 0}
            accent={(h.photos_over_24h ?? 0) > 0}
          />
        </Grid>
      </Section>

      {showPopulation ? (
        <>
          <Section label="Население">
            <Grid>
              <StatCard href="/admin/clients" label="Всего пользователей" value={d.total ?? 0} />
              <StatCard
                href="/admin/clients?status=active"
                label="Активных"
                value={d.lifecycle?.active ?? 0}
              />
              <StatCard
                href="/admin/clients?status=blocked"
                label="Заблокировано"
                value={d.lifecycle?.blocked ?? 0}
              />
            </Grid>
          </Section>

          <Section label="Демография">
            <Grid>
              <StatCard href="/admin/clients?gender=m" label="Мужчин" value={d.gender?.m ?? 0} />
              <StatCard href="/admin/clients?gender=f" label="Женщин" value={d.gender?.f ?? 0} />
            </Grid>
          </Section>
        </>
      ) : null}
    </OpsShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: ADMIN.ink500,
          fontWeight: 500,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  accent = false,
}: {
  href: string;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        background: ADMIN.surface,
        border: `1px solid ${ADMIN.border}`,
        borderLeft: accent ? `3px solid ${ADMIN.accent}` : `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 500,
          color: ADMIN.ink900,
          fontFamily: ADMIN.fontMono,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: ADMIN.ink500,
        }}
      >
        {label}
      </div>
    </Link>
  );
}
