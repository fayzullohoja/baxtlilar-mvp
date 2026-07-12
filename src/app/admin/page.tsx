import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { loadAdminSettings } from "@/lib/admin/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapCount, unwrapOne } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { ChartStyles, GenderBalance } from "@/components/admin-ops/charts";

export const dynamic = "force-dynamic";

type Tone = "muted" | "accent" | "warning" | "danger";
const TONE_COLOR: Record<Tone, string> = {
  muted: ADMIN.ink900,
  accent: ADMIN.accent,
  warning: ADMIN.warning,
  danger: ADMIN.danger,
};

/**
 * Admin Dashboard. Первый экран смены: что требует внимания СЕЙЧАС (очередь, SLA)
 * + пульс платформы для super (аудитория, баланс полов). Цвет числа кодирует
 * срочность — проблема сразу «выстреливает».
 */
export default async function AdminDashboard() {
  const session = await requireAdmin();
  const sb = supabaseAdmin();
  // Демография = analytics-данные (super-only, тот же RPC что /admin/analytics).
  const showPopulation = can(session.role, "analytics.view");

  const { data: admin } = await sb
    .from("admin_users").select("login").eq("id", session.adminId).maybeSingle();

  const [pending, photos, demo, reports, health] = await Promise.all([
    sb.from("verification_cases").select("*", { count: "exact", head: true }).neq("state", "closed"),
    sb.from("profile_photos").select("*", { count: "exact", head: true }).eq("status", "under_review"),
    showPopulation ? sb.rpc("get_admin_demographics") : Promise.resolve({ data: null, error: null }),
    sb.from("reports").select("*", { count: "exact", head: true })
      .in("status", ["new", "in_progress", "requires_clarification", "escalated"]),
    sb.rpc("get_queue_health"),
  ]);

  const pendingCount = unwrapCount(pending);
  const photosCount = unwrapCount(photos);
  const reportsCount = unwrapCount(reports);
  const d = (unwrapOne(demo) ?? {}) as {
    total?: number; gender?: { m: number; f: number }; lifecycle?: Record<string, number>;
  };
  const h = (unwrapOne(health) ?? {}) as {
    open_total?: number; unassigned?: number; oldest_open_hours?: number;
    over_24h?: number; over_72h?: number; photos_over_24h?: number;
  };
  const { slaWarnHours } = await loadAdminSettings();
  const oldestH = Number(h.oldest_open_hours ?? 0);
  const oldestLabel = oldestH >= 24 ? `${Math.floor(oldestH / 24)} дн` : `${Math.round(oldestH)} ч`;
  const oldestTone: Tone = oldestH >= slaWarnHours * 3 ? "danger" : oldestH >= slaWarnHours ? "warning" : "muted";
  const g = d.gender ?? { m: 0, f: 0 };

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <ChartStyles />
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Дашборд</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        Что требует внимания сейчас — очередь модерации, SLA{showPopulation ? " и пульс платформы" : ""}.
      </p>

      <Section label="Очередь модерации">
        <Grid min={220}>
          <Stat href="/admin/queue/mine" label="Заявки на проверке" value={pendingCount}
            tone={pendingCount > 0 ? "accent" : "muted"} cta={pendingCount > 0 ? "разобрать" : "пусто"} />
          <Stat href="/admin/photos" label="Фото на проверке" value={photosCount}
            tone={photosCount > 0 ? "accent" : "muted"} cta={photosCount > 0 ? "разобрать" : "пусто"} />
          <Stat href="/admin/reports" label="Жалобы открытые" value={reportsCount}
            tone={reportsCount > 0 ? "accent" : "muted"} cta={reportsCount > 0 ? "разобрать" : "пусто"} />
        </Grid>
      </Section>

      <Section label="Требуют внимания · SLA">
        <Grid min={190}>
          <Stat href="/admin/queue/mine?view=all" label="Старейший кейс" value={h.open_total ? oldestLabel : "—"} tone={oldestTone} />
          <Stat href="/admin/queue/mine?view=all" label={`Кейсов > 24 ч`} value={h.over_24h ?? 0} tone={(h.over_24h ?? 0) > 0 ? "warning" : "muted"} />
          <Stat href="/admin/queue/mine?view=all" label={`Кейсов > 72 ч`} value={h.over_72h ?? 0} tone={(h.over_72h ?? 0) > 0 ? "danger" : "muted"} />
          <Stat href="/admin/queue/mine?view=all" label="Без владельца" value={h.unassigned ?? 0} tone={(h.unassigned ?? 0) > 0 ? "warning" : "muted"} />
          <Stat href="/admin/photos?tab=overdue" label="Фото > 24 ч" value={h.photos_over_24h ?? 0} tone={(h.photos_over_24h ?? 0) > 0 ? "warning" : "muted"} />
        </Grid>
      </Section>

      {showPopulation ? (
        <Section label="Аудитория">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 1.2fr) minmax(260px, 1fr)",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {/* Баланс полов — здоровье маркетплейса */}
            <div className="bxcard" style={card}>
              <div style={cardLabel}>Баланс полов</div>
              <GenderBalance m={g.m} f={g.f} />
              <Link href="/admin/analytics" style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: ADMIN.accent, textDecoration: "none" }}>
                Полная аналитика →
              </Link>
            </div>
            {/* Ключевые числа */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Stat href="/admin/clients" label="Всего" value={d.total ?? 0} tone="muted" />
              <Stat href="/admin/clients?status=active" label="Активных" value={d.lifecycle?.active ?? 0} tone="accent" />
              <Stat href="/admin/clients?status=blocked" label="Заблокировано" value={d.lifecycle?.blocked ?? 0} tone={(d.lifecycle?.blocked ?? 0) > 0 ? "danger" : "muted"} />
              <Stat href="/admin/clients?status=deleted" label="Удалённых" value={d.lifecycle?.deleted ?? 0} tone="muted" />
            </div>
          </div>
        </Section>
      ) : null}
    </OpsShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: ADMIN.ink500, fontWeight: 600, marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, min = 220 }: { children: React.ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
      {children}
    </div>
  );
}

function Stat({
  href, label, value, tone = "muted", cta,
}: {
  href: string; label: string; value: number | string; tone?: Tone; cta?: string;
}) {
  const active = tone !== "muted";
  return (
    <Link
      href={href}
      className="bxcard"
      style={{
        display: "block",
        textDecoration: "none",
        background: ADMIN.surface,
        border: `1px solid ${ADMIN.border}`,
        borderLeft: active ? `3px solid ${TONE_COLOR[tone]}` : `1px solid ${ADMIN.border}`,
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, color: TONE_COLOR[tone], fontFamily: ADMIN.fontMono, lineHeight: 1.05 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: ADMIN.ink500 }}>{label}</span>
        {cta ? (
          <span style={{ fontSize: 11, color: active ? ADMIN.accent : ADMIN.ink300 }}>
            {active ? `${cta} →` : cta}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

const card: React.CSSProperties = {
  padding: 20,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 10,
  background: ADMIN.surface,
};
const cardLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: ADMIN.ink500,
  marginBottom: 16,
};
