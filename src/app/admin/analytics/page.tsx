import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";
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

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return Math.round((part / whole) * 100) + "%";
}

/** Полоса соотношения мужчины/женщины. */
function GenderBar({ m, f }: { m: number; f: number }) {
  const total = m + f;
  const mPct = total > 0 ? (m / total) * 100 : 0;
  const fPct = total > 0 ? (f / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-sky-500" style={{ width: `${mPct}%` }} />
        <div className="bg-baxt-coral" style={{ width: `${fPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-sky-600">♂ Мужчины — {m} ({pct(m, total)})</span>
        <span className="text-baxt-coral">♀ Женщины — {f} ({pct(f, total)})</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className={"text-3xl font-bold " + (accent ? "text-baxt-coral" : "text-slate-900")}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await requireAdmin();
  const { data } = await supabaseAdmin().rpc("get_admin_demographics");
  const d = (data ?? null) as Demographics | null;

  if (!d) {
    return (
      <AdminShell active="/admin/analytics" role={session.role}>
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Демография</h1>
        <p className="text-slate-400">Нет данных.</p>
      </AdminShell>
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
    <AdminShell active="/admin/analytics" role={session.role}>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Демография</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniStat label="Всего пользователей" value={d.total} />
        <MiniStat label="С анкетой" value={d.with_profile} />
        <MiniStat label="Новых за 7 дней" value={d.reg_7d} accent />
        <MiniStat label="Сегодня" value={d.reg_today} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Section title="Пол (среди заполнивших анкету)">
          <GenderBar m={d.gender.m} f={d.gender.f} />
          <p className="mt-3 text-xs text-slate-400">
            Пол определяется на шаге анкеты. Пользователи без анкеты сюда не входят.
          </p>
        </Section>

        <Section title="Активные по полу">
          <GenderBar m={d.active_gender.m} f={d.active_gender.f} />
          <p className="mt-3 text-xs text-slate-400">
            Только пользователи в статусе «Активные» (готовы к подбору).
          </p>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Section title="Возраст по полу">
          {d.age_buckets.length === 0 ? (
            <p className="text-sm text-slate-400">Нет данных.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1.5 font-medium">Возраст</th>
                  <th className="py-1.5 font-medium text-sky-600">♂ М</th>
                  <th className="py-1.5 font-medium text-baxt-coral">♀ Ж</th>
                  <th className="py-1.5 font-medium">Всего</th>
                </tr>
              </thead>
              <tbody>
                {d.age_buckets.map((b) => (
                  <tr key={b.bucket} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{b.bucket}</td>
                    <td className="py-1.5 text-slate-600">{b.m}</td>
                    <td className="py-1.5 text-slate-600">{b.f}</td>
                    <td className="py-1.5 font-medium text-slate-800">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="География (по областям)">
          {regions.length === 0 ? (
            <p className="text-sm text-slate-400">Нет данных.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1.5 font-medium">Область</th>
                  <th className="py-1.5 font-medium text-sky-600">♂ М</th>
                  <th className="py-1.5 font-medium text-baxt-coral">♀ Ж</th>
                  <th className="py-1.5 font-medium">Всего</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(([region, v]) => (
                  <tr key={region} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{region}</td>
                    <td className="py-1.5 text-slate-600">{v.m}</td>
                    <td className="py-1.5 text-slate-600">{v.f}</td>
                    <td className="py-1.5 font-medium text-slate-800">{v.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Section title="Топ городов">
          {topCities.length === 0 ? (
            <p className="text-sm text-slate-400">Нет данных.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {topCities.map((c) => (
                <li key={c.city} className="flex justify-between">
                  <span className="text-slate-700">{cityLabel(c.city, "ru")}</span>
                  <span className="text-slate-500">
                    {c.n} <span className="text-xs">(♂{c.m} / ♀{c.f})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Статусы и верификация">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-slate-400">Жизненный цикл</div>
              {Object.entries(d.lifecycle).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{LIFECYCLE_RU[k] ?? k}</span>
                  <span className="text-slate-800">{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-slate-400">Верификация</div>
              {Object.entries(d.verification).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{VERIFICATION_RU[k] ?? k}</span>
                  <span className="text-slate-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
