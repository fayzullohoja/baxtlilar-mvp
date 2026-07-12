import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { cityLabel, regionLabelOfCity } from "@/lib/profile/cities";
import { LIFECYCLE_RU, VERIFICATION_RU } from "@/lib/admin/labels";
import {
  ChartStyles,
  StatHero,
  FunnelChart,
  HBarList,
  GenderBalance,
  VizCard,
  type BarRow,
  type FunnelStage,
} from "@/components/admin-ops/charts";

export const dynamic = "force-dynamic";

type Demographics = {
  total: number;
  with_profile: number;
  gender: { m: number; f: number };
  active_gender: { m: number; f: number };
  age_buckets: { bucket: string; m: number; f: number; n: number }[];
  cities: { city: string; m: number; f: number; n: number }[];
  lifecycle: Record<string, number>;
  verification: Record<string, number>;
  reg_today: number;
  reg_7d: number;
  reg_30d: number;
};

type StageCount = { n: number; m: number; f: number };

type FunnelData = {
  funnel: {
    signup: StageCount;
    verified: StageCount;
    published: StageCount;
    first_mutual: StageCount;
    chat_unlocked: StageCount;
  };
  empty_feed: {
    eligible: number;
    empty: number;
    by_gender: { m: { eligible: number; empty: number }; f: { eligible: number; empty: number } };
    by_city: { city: string; eligible: number; empty: number }[];
  };
  rates: {
    onboarding: { total: number; past_onboarding: number };
    verification: { submitted: number; approved: number };
  };
  north_star: number;
};

const FUNNEL_KEYS: { key: keyof FunnelData["funnel"]; label: string }[] = [
  { key: "signup", label: "Регистрация" },
  { key: "verified", label: "Верифицированы" },
  { key: "published", label: "Анкета опубликована" },
  { key: "first_mutual", label: "Взаимный интерес" },
  { key: "chat_unlocked", label: "Чат открыт" },
];

function pctStr(part: number, whole: number): string {
  return whole > 0 ? Math.round((part / whole) * 100) + "%" : "0%";
}

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16,
  marginTop: 16,
};

export default async function AnalyticsPage() {
  const session = await requireAdmin();
  // RBAC (Волна 7): аналитика — super-only.
  if (!can(session.role, "analytics.view")) notFound();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  const [demoRes, funnelRes] = await Promise.all([
    supabaseAdmin().rpc("get_admin_demographics"),
    supabaseAdmin().rpc("get_admin_funnel"),
  ]);
  const d = unwrapOne(demoRes) as Demographics | null;
  const fu = unwrapOne(funnelRes) as FunnelData | null;

  if (!d) {
    return (
      <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>Аналитика</h1>
        <p style={{ fontSize: 13, color: ADMIN.ink500 }}>Нет данных.</p>
      </OpsShell>
    );
  }

  // География: агрегируем города в регионы.
  const byRegion = new Map<string, { m: number; f: number; n: number }>();
  for (const c of d.cities) {
    const region = regionLabelOfCity(c.city, "ru");
    const cur = byRegion.get(region) ?? { m: 0, f: 0, n: 0 };
    cur.m += c.m; cur.f += c.f; cur.n += c.n;
    byRegion.set(region, cur);
  }
  const regionRows: BarRow[] = [...byRegion.entries()]
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8)
    .map(([name, v]) => ({ label: name, value: v.n, m: v.m, f: v.f }));

  const ageRows: BarRow[] = d.age_buckets.map((b) => ({ label: b.bucket, value: b.n, m: b.m, f: b.f }));
  const verifRows: BarRow[] = Object.entries(d.verification)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: VERIFICATION_RU[k] ?? k, value: v }));
  const lifeRows: BarRow[] = Object.entries(d.lifecycle)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: LIFECYCLE_RU[k] ?? k, value: v }));

  const funnelStages: FunnelStage[] = fu
    ? FUNNEL_KEYS.map((s) => ({ label: s.label, n: fu.funnel[s.key].n, m: fu.funnel[s.key].m, f: fu.funnel[s.key].f }))
    : [];
  const emptyCityRows: BarRow[] = fu
    ? fu.empty_feed.by_city.filter((c) => c.empty > 0).sort((a, b) => b.empty - a.empty).slice(0, 8)
        .map((c) => ({ label: cityLabel(c.city, "ru"), value: c.empty }))
    : [];

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <ChartStyles />
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Аналитика</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 20 }}>
        Куда движется маркетплейс: рост, воронка до первого чата, баланс полов и география.
      </p>

      {/* Ключевые метрики */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {fu ? (
          <StatHero
            value={fu.north_star}
            label="Северная звезда — взаимные пары с чатом"
            tone="accent"
            accent
          />
        ) : null}
        <StatHero value={d.total} label="Всего пользователей" delay={40} />
        <StatHero value={d.with_profile} label="С заполненной анкетой" delay={80} />
        <StatHero
          value={`+${d.reg_7d}`}
          label="Новых за 7 дней"
          sub={`сегодня +${d.reg_today} · 30 дн +${d.reg_30d}`}
          tone="success"
          delay={120}
        />
      </div>

      {/* Воронка — сигнатура */}
      {fu ? (
        <div style={{ marginTop: 16 }}>
          <VizCard
            title="Воронка — путь до первого чата"
            hint="ширина ∝ доле от регистраций · ♂ slate / ♀ глина"
          >
            <FunnelChart stages={funnelStages} />
            <p style={{ marginTop: 16, fontSize: 12, color: ADMIN.ink500, lineHeight: 1.5 }}>
              Пока чат открывается синхронно при взаимности, «Взаимный интерес» и «Чат
              открыт» совпадают. Завершают онбординг:{" "}
              <b style={{ color: ADMIN.ink900 }}>
                {pctStr(fu.rates.onboarding.past_onboarding, fu.rates.onboarding.total)}
              </b>{" "}
              · верификация одобрена:{" "}
              <b style={{ color: ADMIN.ink900 }}>
                {pctStr(fu.rates.verification.approved, fu.rates.verification.submitted)}
              </b>
              .
            </p>
          </VizCard>
        </div>
      ) : null}

      {/* Баланс полов + возраст */}
      <div style={grid2}>
        <VizCard title="Баланс полов" hint="среди заполнивших анкету">
          <GenderBalance m={d.gender.m} f={d.gender.f} />
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${ADMIN.border}` }}>
            <div style={{ fontSize: 11, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Среди активных (готовы к подбору)
            </div>
            <GenderBalance m={d.active_gender.m} f={d.active_gender.f} />
          </div>
        </VizCard>

        <VizCard title="Возраст" hint="♂ / ♀ в каждой группе">
          <HBarList rows={ageRows} showSex labelWidth={64} />
        </VizCard>
      </div>

      {/* География + статусы */}
      <div style={grid2}>
        <VizCard title="География" hint="топ регионов, ♂ / ♀">
          <HBarList rows={regionRows} showSex labelWidth={130} />
        </VizCard>

        <VizCard title="Статусы аккаунтов">
          <HBarList rows={lifeRows} color={ADMIN.accent} labelWidth={130} />
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${ADMIN.border}` }}>
            <div style={{ fontSize: 11, color: ADMIN.ink500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Верификация
            </div>
            <HBarList rows={verifRows} color={ADMIN.ink500} labelWidth={130} />
          </div>
        </VizCard>
      </div>

      {/* Пустой фид — дефицит противоположного пола по городам */}
      {fu ? (
        <div style={{ marginTop: 16 }}>
          <VizCard
            title="Пустой фид — где строгий подбор не находит никого"
            hint={`всего ${pctStr(fu.empty_feed.empty, fu.empty_feed.eligible)} активных анкет`}
          >
            {emptyCityRows.length === 0 ? (
              <p style={{ fontSize: 13, color: ADMIN.success }}>
                Во всех городах подбор находит кандидатов. 🎉
              </p>
            ) : (
              <>
                <HBarList rows={emptyCityRows} color={ADMIN.danger} labelWidth={130} />
                <p style={{ marginTop: 16, fontSize: 12, color: ADMIN.ink500, lineHeight: 1.5 }}>
                  Число анкет, которым строгий подбор (без расширения возраста) не даёт ни
                  одного кандидата. Высокое значение = дефицит противоположного пола в нужных
                  возрастах именно в этом городе.
                </p>
              </>
            )}
          </VizCard>
        </div>
      ) : null}
    </OpsShell>
  );
}
