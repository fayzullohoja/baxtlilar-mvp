import { ADMIN } from "@/lib/admin/admin-tokens";

// Лёгкие серверно-рендерящиеся дата-виз примитивы для админ-аналитики/дашборда.
// Без библиотек и client-JS: CSS/SVG + мягкая scale-in анимация на загрузке
// (respect prefers-reduced-motion). Живут в slate-палитре ADMIN (вариант A).

// Пол: slate-blue (♂) + тёплая глина (♀) — различимо и достойно, без cyan/pink.
export const SEX = { m: ADMIN.accent, f: "#9c6b5e" } as const;

// Однократно вставляемые keyframes (импортируется страницей один раз).
export function ChartStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@keyframes bxgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bxrise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.bxbar{transform-origin:left center;animation:bxgrow .6s cubic-bezier(.22,1,.36,1) both}
.bxcard{animation:bxrise .5s ease both}
@media (prefers-reduced-motion:reduce){.bxbar,.bxcard{animation:none}}
`,
      }}
    />
  );
}

function fmt(n: number): string {
  return n >= 10000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(n);
}
function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

// ─── Крупная герой-цифра ────────────────────────────────────────────────────
export function StatHero({
  value,
  label,
  sub,
  accent,
  tone = "ink",
  delay = 0,
}: {
  value: number | string;
  label: string;
  sub?: string;
  accent?: boolean;
  tone?: "ink" | "accent" | "success" | "warning" | "danger";
  delay?: number;
}) {
  const color =
    tone === "accent" ? ADMIN.accent
    : tone === "success" ? ADMIN.success
    : tone === "warning" ? ADMIN.warning
    : tone === "danger" ? ADMIN.danger
    : ADMIN.ink900;
  return (
    <div
      className="bxcard"
      style={{
        padding: "18px 20px",
        border: `1px solid ${ADMIN.border}`,
        borderLeft: accent ? `3px solid ${ADMIN.accent}` : `1px solid ${ADMIN.border}`,
        borderRadius: 10,
        background: ADMIN.surface,
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.05, color, fontFamily: ADMIN.fontMono }}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: ADMIN.ink500, lineHeight: 1.35 }}>{label}</div>
      {sub ? <div style={{ marginTop: 4, fontSize: 12, color: ADMIN.ink700 }}>{sub}</div> : null}
    </div>
  );
}

// ─── Конверсионная воронка (СИГНАТУРА) ──────────────────────────────────────
export type FunnelStage = { label: string; n: number; m?: number; f?: number };

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.n || 1;
  // Худший шаг-переход (для подсветки «где теряем больше всего»).
  let worstIdx = -1;
  let worstDrop = 0;
  for (let i = 1; i < stages.length; i++) {
    const drop = stages[i - 1].n - stages[i].n;
    const rate = stages[i - 1].n > 0 ? drop / stages[i - 1].n : 0;
    if (rate > worstDrop && drop > 0) {
      worstDrop = rate;
      worstIdx = i;
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {stages.map((s, i) => {
        const w = Math.max(pct(s.n, top), s.n > 0 ? 4 : 0);
        // Метка оттока — только на реальном падении (n < prev). Флэт/рост (напр.
        // «опубликовано» ≥ «верифицировано») не помечаем как «↓».
        const prevN = i > 0 ? stages[i - 1].n : s.n;
        const dropped = i > 0 && s.n < prevN;
        const keptPct = dropped ? pct(s.n, prevN) : null;
        const isWorst = i === worstIdx;
        const mW = s.m != null && s.n > 0 ? (s.m / s.n) * 100 : 0;
        return (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {keptPct != null ? (
              <div
                style={{
                  fontSize: 11,
                  color: isWorst ? ADMIN.danger : ADMIN.ink300,
                  paddingLeft: 4,
                  fontFamily: ADMIN.fontMono,
                }}
              >
                ↓ дошло {Math.round(keptPct)}%{isWorst ? " — крупнейший отток" : ""}
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* центрированная сужающаяся полоса — форма воронки */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    className="bxbar"
                    style={{
                      width: `${w}%`,
                      height: 34,
                      borderRadius: 6,
                      overflow: "hidden",
                      display: "flex",
                      animationDelay: `${i * 90}ms`,
                      boxShadow: isWorst ? `inset 0 0 0 1px ${ADMIN.danger}` : "none",
                    }}
                  >
                    <div style={{ width: `${mW}%`, background: SEX.m }} />
                    <div style={{ flex: 1, background: SEX.f }} />
                  </div>
                </div>
              </div>
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ fontSize: 13, color: ADMIN.ink900, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: ADMIN.ink500, fontFamily: ADMIN.fontMono }}>
                  {fmt(s.n)} · {Math.round(pct(s.n, top))}% от старта
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Горизонтальный бар-лист (возраст/города/статусы) ───────────────────────
export type BarRow = { label: string; value: number; m?: number; f?: number };

export function HBarList({
  rows,
  color = ADMIN.accent,
  showSex = false,
  labelWidth = 120,
}: {
  rows: BarRow[];
  color?: string;
  showSex?: boolean;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0)
    return <div style={{ fontSize: 13, color: ADMIN.ink500 }}>Нет данных.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        const w = pct(r.value, max);
        const mW = showSex && r.m != null && r.value > 0 ? (r.m / r.value) * 100 : 0;
        return (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: labelWidth,
                flexShrink: 0,
                fontSize: 12,
                color: ADMIN.ink700,
                textAlign: "right",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.label}
            </div>
            <div style={{ flex: 1, height: 18, background: ADMIN.surface2, borderRadius: 5, overflow: "hidden" }}>
              <div
                className="bxbar"
                style={{
                  width: `${Math.max(w, r.value > 0 ? 2 : 0)}%`,
                  height: "100%",
                  display: "flex",
                  animationDelay: `${i * 45}ms`,
                }}
              >
                {showSex ? (
                  <>
                    <div style={{ width: `${mW}%`, background: SEX.m }} />
                    <div style={{ flex: 1, background: SEX.f }} />
                  </>
                ) : (
                  <div style={{ width: "100%", background: color }} />
                )}
              </div>
            </div>
            <div
              style={{
                width: 44,
                flexShrink: 0,
                fontSize: 12,
                color: ADMIN.ink500,
                fontFamily: ADMIN.fontMono,
                textAlign: "right",
              }}
            >
              {fmt(r.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Гендер-баланс (герой для маркетплейса знакомств) ───────────────────────
export function GenderBalance({ m, f }: { m: number; f: number }) {
  const total = m + f;
  const mPct = pct(m, total);
  const fPct = pct(f, total);
  // Осмысленный инсайт: сколько ♂ на одну ♀ (перекос предложения/спроса).
  const ratio =
    f > 0 && m > 0
      ? m >= f
        ? `≈ ${(m / f).toFixed(1)} ♂ на 1 ♀`
        : `≈ ${(f / m).toFixed(1)} ♀ на 1 ♂`
      : "—";
  const skew = total > 0 ? Math.abs(mPct - fPct) : 0;
  const skewTone = skew > 40 ? ADMIN.danger : skew > 20 ? ADMIN.warning : ADMIN.success;
  return (
    <div>
      <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", background: ADMIN.surface2 }}>
        <div className="bxbar" style={{ width: `${mPct}%`, background: SEX.m }} />
        <div className="bxbar" style={{ width: `${fPct}%`, background: SEX.f, animationDelay: "80ms" }} />
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: SEX.m, fontWeight: 500 }}>
          ♂ {m} · {Math.round(mPct)}%
        </span>
        <span style={{ color: SEX.f, fontWeight: 500 }}>
          {Math.round(fPct)}% · {f} ♀
        </span>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: skewTone, fontWeight: 500 }}>{ratio}</div>
    </div>
  );
}

// ─── Карточка-секция ────────────────────────────────────────────────────────
export function VizCard({
  title,
  hint,
  children,
  span,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <section
      className="bxcard"
      style={{
        padding: 20,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 10,
        background: ADMIN.surface,
        gridColumn: span ? `span ${span}` : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: ADMIN.ink500,
            margin: 0,
          }}
        >
          {title}
        </h2>
        {hint ? <span style={{ fontSize: 11, color: ADMIN.ink300 }}>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
