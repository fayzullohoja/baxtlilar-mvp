import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { OpsShell } from "@/components/admin-ops/OpsShell";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { cityLabel, regionLabelOfCity } from "@/lib/profile/cities";
import { LIFECYCLE_RU, VERIFICATION_RU } from "@/lib/admin/labels";

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

const FUNNEL_STAGES: { key: keyof FunnelData["funnel"]; label: string }[] = [
  { key: "signup", label: "Регистрация" },
  { key: "verified", label: "Верифицированы" },
  { key: "published", label: "Анкета опубликована" },
  { key: "first_mutual", label: "Первый взаимный интерес" },
  { key: "chat_unlocked", label: "Чат открыт" },
];

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return Math.round((part / whole) * 100) + "%";
}

const cardStyle = {
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
  padding: 20,
} as const;

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

const td = { padding: "10px 12px", fontSize: 13, color: ADMIN.ink700 } as const;
const tdNum = {
  padding: "10px 12px",
  fontSize: 13,
  color: ADMIN.ink500,
  fontFamily: ADMIN.fontMono,
} as const;

/** Полоса соотношения мужчины/женщины (slate-blue, без cyan/pink). */
function GenderBar({ m, f }: { m: number; f: number }) {
  const total = m + f;
  const mPct = total > 0 ? (m / total) * 100 : 0;
  const fPct = total > 0 ? (f / total) * 100 : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 12,
          width: "100%",
          overflow: "hidden",
          borderRadius: 999,
          background: ADMIN.surface2,
        }}
      >
        <div style={{ width: `${mPct}%`, background: ADMIN.accent }} />
        <div style={{ width: `${fPct}%`, background: ADMIN.ink300 }} />
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        <span style={{ color: ADMIN.accent }}>
          ♂ Мужчины — {m} ({pct(m, total)})
        </span>
        <span style={{ color: ADMIN.ink500 }}>
          ♀ Женщины — {f} ({pct(f, total)})
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <h2
        style={{
          marginBottom: 16,
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: ADMIN.ink500,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={cardStyle}>
      <div
        style={{ fontSize: 28, fontWeight: 600, color: ADMIN.ink900, lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: ADMIN.ink500 }}>{label}</div>
    </div>
  );
}

function noData() {
  return <p style={{ fontSize: 13, color: ADMIN.ink500 }}>Нет данных.</p>;
}

export default async function AnalyticsPage() {
  const session = await requireAdmin();

  const { data: admin } = await supabaseAdmin()
    .from("admin_users")
    .select("login")
    .eq("id", session.adminId)
    .maybeSingle();

  // unwrapOne бросает на сбое БД; genuine «нет данных» (null) ниже даёт «Нет данных».
  const [demoRes, funnelRes] = await Promise.all([
    supabaseAdmin().rpc("get_admin_demographics"),
    supabaseAdmin().rpc("get_admin_funnel"),
  ]);
  const d = unwrapOne(demoRes) as Demographics | null;
  const f = unwrapOne(funnelRes) as FunnelData | null;

  if (!d) {
    return (
      <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>
          Демография
        </h1>
        <p style={{ fontSize: 13, color: ADMIN.ink500 }}>Нет данных.</p>
      </OpsShell>
    );
  }

  // агрегируем города в регионы (область) для географии
  const byRegion = new Map<string, { m: number; f: number; n: number }>();
  for (const c of d.cities) {
    const region = regionLabelOfCity(c.city, "ru");
    const cur = byRegion.get(region) ?? { m: 0, f: 0, n: 0 };
    cur.m += c.m;
    cur.f += c.f;
    cur.n += c.n;
    byRegion.set(region, cur);
  }
  const regions = [...byRegion.entries()].sort((a, b) => b[1].n - a[1].n);
  const topCities = [...d.cities].sort((a, b) => b.n - a.n).slice(0, 12);

  return (
    <OpsShell adminName={admin?.login ?? "—"} adminRole={session.role}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Демография</h1>
      <p style={{ color: ADMIN.ink500, fontSize: 13, marginBottom: 24 }}>
        Состав аудитории, пол, возраст, география и статусы
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <MiniStat label="Всего пользователей" value={d.total} />
        <MiniStat label="С анкетой" value={d.with_profile} />
        <MiniStat label="Новых за 7 дней" value={d.reg_7d} />
        <MiniStat label="Сегодня" value={d.reg_today} />
      </div>

      {/* FUNNEL-2..4: North Star + воронка + пустой фид (get_admin_funnel) */}
      {f && (
        <>
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <MiniStat
              label="Северная звезда — взаимные пары с начатым чатом"
              value={f.north_star}
            />
            <MiniStat
              label="Завершают онбординг"
              value={pct(f.rates.onboarding.past_onboarding, f.rates.onboarding.total)}
            />
            <MiniStat
              label="Верификация одобрена"
              value={pct(f.rates.verification.approved, f.rates.verification.submitted)}
            />
            <MiniStat
              label="Пустой фид (строгий подбор)"
              value={pct(f.empty_feed.empty, f.empty_feed.eligible)}
            />
          </div>

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            <Section title="Воронка">
              {FUNNEL_STAGES.map((s, i) => {
                const cur = f.funnel[s.key];
                const base = f.funnel.signup.n;
                const prev = i > 0 ? f.funnel[FUNNEL_STAGES[i - 1].key].n : cur.n;
                const w =
                  cur.n === 0 || base === 0
                    ? 0
                    : Math.max(2, Math.round((cur.n / base) * 100));
                return (
                  <div key={s.key} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: ADMIN.ink700 }}>{s.label}</span>
                      <span style={{ color: ADMIN.ink500, fontFamily: ADMIN.fontMono }}>
                        {cur.n}{" "}
                        <span style={{ fontSize: 11 }}>
                          (♂{cur.m} / ♀{cur.f})
                        </span>
                        {i > 0 && (
                          <span style={{ marginLeft: 8, color: ADMIN.ink900 }}>
                            {pct(cur.n, prev)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: ADMIN.surface2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{ width: `${w}%`, height: "100%", background: ADMIN.accent }}
                      />
                    </div>
                  </div>
                );
              })}
              <p style={{ marginTop: 12, fontSize: 12, color: ADMIN.ink500 }}>
                Процент — конверсия из предыдущего шага. Пока чат создаётся
                синхронно при взаимности, «Первый взаимный интерес» и «Чат
                открыт» совпадают. «Завершают онбординг» — прокси: событие
                «открыл приложение» не трекается.
              </p>
            </Section>

            <Section title="Пустой фид по городам (строгий подбор)">
              {f.empty_feed.by_city.length === 0 ? (
                noData()
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                      <th style={th}>Город</th>
                      <th style={th}>В подборе</th>
                      <th style={th}>Пустой фид</th>
                      <th style={th}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.empty_feed.by_city.map((c) => (
                      <tr
                        key={c.city}
                        style={{ borderBottom: `1px solid ${ADMIN.border}` }}
                      >
                        <td style={td}>{cityLabel(c.city, "ru")}</td>
                        <td style={tdNum}>{c.eligible}</td>
                        <td style={tdNum}>{c.empty}</td>
                        <td style={{ ...tdNum, color: ADMIN.ink900, fontWeight: 500 }}>
                          {pct(c.empty, c.eligible)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ marginTop: 12, fontSize: 12, color: ADMIN.ink500 }}>
                Доля активных опубликованных анкет, которым строгий подбор
                (уровень 0, без расширения возраста) не находит ни одного
                кандидата. Высокий % в городе = дефицит противоположного пола
                в нужных возрастах.
              </p>
            </Section>
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <Section title="Пол (среди заполнивших анкету)">
          <GenderBar m={d.gender.m} f={d.gender.f} />
          <p style={{ marginTop: 12, fontSize: 12, color: ADMIN.ink500 }}>
            Пол определяется на шаге анкеты. Пользователи без анкеты сюда не входят.
          </p>
        </Section>

        <Section title="Активные по полу">
          <GenderBar m={d.active_gender.m} f={d.active_gender.f} />
          <p style={{ marginTop: 12, fontSize: 12, color: ADMIN.ink500 }}>
            Только пользователи в статусе «Активные» (готовы к подбору).
          </p>
        </Section>
      </div>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <Section title="Возраст по полу">
          {d.age_buckets.length === 0 ? (
            noData()
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                  <th style={th}>Возраст</th>
                  <th style={th}>♂ М</th>
                  <th style={th}>♀ Ж</th>
                  <th style={th}>Всего</th>
                </tr>
              </thead>
              <tbody>
                {d.age_buckets.map((b) => (
                  <tr
                    key={b.bucket}
                    style={{ borderBottom: `1px solid ${ADMIN.border}` }}
                  >
                    <td style={td}>{b.bucket}</td>
                    <td style={tdNum}>{b.m}</td>
                    <td style={tdNum}>{b.f}</td>
                    <td
                      style={{
                        ...tdNum,
                        color: ADMIN.ink900,
                        fontWeight: 500,
                      }}
                    >
                      {b.n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="География (по областям)">
          {regions.length === 0 ? (
            noData()
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                  <th style={th}>Область</th>
                  <th style={th}>♂ М</th>
                  <th style={th}>♀ Ж</th>
                  <th style={th}>Всего</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(([region, v]) => (
                  <tr
                    key={region}
                    style={{ borderBottom: `1px solid ${ADMIN.border}` }}
                  >
                    <td style={td}>{region}</td>
                    <td style={tdNum}>{v.m}</td>
                    <td style={tdNum}>{v.f}</td>
                    <td style={{ ...tdNum, color: ADMIN.ink900, fontWeight: 500 }}>
                      {v.n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        <Section title="Топ городов">
          {topCities.length === 0 ? (
            noData()
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {topCities.map((c) => (
                <li
                  key={c.city}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: ADMIN.ink700 }}>
                    {cityLabel(c.city, "ru")}
                  </span>
                  <span
                    style={{ color: ADMIN.ink500, fontFamily: ADMIN.fontMono }}
                  >
                    {c.n}{" "}
                    <span style={{ fontSize: 11 }}>
                      (♂{c.m} / ♀{c.f})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Статусы и верификация">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 24,
              rowGap: 6,
              fontSize: 13,
            }}
          >
            <div>
              <div
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: ADMIN.ink500,
                }}
              >
                Жизненный цикл
              </div>
              {Object.entries(d.lifecycle).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                  }}
                >
                  <span style={{ color: ADMIN.ink700 }}>{LIFECYCLE_RU[k] ?? k}</span>
                  <span
                    style={{ color: ADMIN.ink900, fontFamily: ADMIN.fontMono }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: ADMIN.ink500,
                }}
              >
                Верификация
              </div>
              {Object.entries(d.verification).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                  }}
                >
                  <span style={{ color: ADMIN.ink700 }}>
                    {VERIFICATION_RU[k] ?? k}
                  </span>
                  <span
                    style={{ color: ADMIN.ink900, fontFamily: ADMIN.fontMono }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </OpsShell>
  );
}
