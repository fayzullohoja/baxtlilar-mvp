import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapCount, unwrapOne } from "@/lib/db/unwrap";
import { V2AdminShell, AdminH1, MetricCard } from "@/components/v2/AdminShell";

export const dynamic = "force-dynamic";

/**
 * V2 Admin Dashboard (Blueprint §4.2).
 *
 * Editorial DNA: large serif metrics, sectioned by priority
 * (Очередь / Население). Accent border на тех card что > 0 — модератор
 * сразу видит «есть работа».
 */
export default async function AdminDashboard() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();

  const [pending, photos, demo, reports] = await Promise.all([
    sb
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
    sb
      .from("profile_photos")
      .select("*", { count: "exact", head: true })
      .eq("status", "under_review"),
    sb.rpc("get_admin_demographics"),
    sb
      .from("reports")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "in_progress", "requires_clarification", "escalated"]),
  ]);

  const pendingCount = unwrapCount(pending);
  const photosCount = unwrapCount(photos);
  const reportsCount = unwrapCount(reports);
  const d = (unwrapOne(demo) ?? {}) as {
    total?: number;
    gender?: { m: number; f: number };
    lifecycle?: Record<string, number>;
  };

  return (
    <V2AdminShell active="/admin" role={session.role}>
      <AdminH1 subtitle="Сегодняшняя работа модерации и общее население платформы.">
        Дашборд
      </AdminH1>

      <Section label="Очередь модерации">
        <Grid>
          <MetricCard
            href="/admin/verifications"
            label="Заявки на проверке"
            value={pendingCount}
            accent={pendingCount > 0}
          />
          <MetricCard
            href="/admin/photos"
            label="Фото на проверке"
            value={photosCount}
            accent={photosCount > 0}
          />
          <MetricCard
            href="/admin/reports"
            label="Жалобы открытые"
            value={reportsCount}
            accent={reportsCount > 0}
          />
        </Grid>
      </Section>

      <Section label="Население">
        <Grid>
          <MetricCard href="/admin/users" label="Всего пользователей" value={d.total ?? 0} />
          <MetricCard
            href="/admin/users?status=active"
            label="Активных"
            value={d.lifecycle?.active ?? 0}
          />
          <MetricCard
            href="/admin/users?status=blocked"
            label="Заблокировано"
            value={d.lifecycle?.blocked ?? 0}
          />
        </Grid>
      </Section>

      <Section label="Демография">
        <Grid>
          <MetricCard href="/admin/users?gender=m" label="Мужчин" value={d.gender?.m ?? 0} />
          <MetricCard href="/admin/users?gender=f" label="Женщин" value={d.gender?.f ?? 0} />
        </Grid>
      </Section>
    </V2AdminShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "40px" }}>
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "var(--color-v2-ink-400)",
          fontFamily: "var(--font-v2-body)",
          marginBottom: "16px",
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
        gap: "16px",
      }}
    >
      {children}
    </div>
  );
}
