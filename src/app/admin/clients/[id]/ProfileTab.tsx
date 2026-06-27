import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { cityLabel } from "@/lib/profile/cities";
import {
  labelOf,
  MARITAL_STATUS,
  HAS_CHILDREN,
  CHILDREN_PLAN,
  RELIGION,
  RELIGION_IMPORTANCE,
  LIFE_VALUES,
  EDUCATION,
  EMPLOYMENT,
  GEO_PREFERENCE,
  GENDER,
} from "@/lib/profile/options";

type Profile = {
  display_name: string | null;
  gender: string | null;
  city: string | null;
  bio: string | null;
  marital_status: string | null;
  has_children: string | null;
  children_plan: string | null;
  religion: string | null;
  religion_importance: string | null;
  values: string[] | null;
  education: string | null;
  employment: string | null;
  looking_for_gender: string | null;
  partner_age_min: number | null;
  partner_age_max: number | null;
  geo_preference: string | null;
  languages: string[] | null;
  status: string | null;
  published_at: string | null;
};

export async function ProfileTab({ userId }: { userId: string }) {
  const { data } = await supabaseAdmin()
    .from("user_profiles")
    .select(
      "display_name, gender, city, bio, marital_status, has_children, children_plan, religion, religion_importance, values, education, employment, looking_for_gender, partner_age_min, partner_age_max, geo_preference, languages, status, published_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  const p = data as Profile | null;

  if (!p) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
          color: ADMIN.ink500,
          fontSize: 13,
        }}
      >
        Анкета не заполнена.
      </div>
    );
  }

  const lf = (opts: { value: string; ru: string; uz: string }[], v: string | null) =>
    v ? labelOf(opts, v, "ru") : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500 }}>
          {p.display_name ?? "—"}
        </span>
        {p.status === "published" ? (
          <StatusPill kind="active">опубликована</StatusPill>
        ) : (
          <StatusPill kind="pending">{p.status ?? "черновик"}</StatusPill>
        )}
      </div>

      {p.bio ? (
        <div
          style={{
            padding: 16,
            border: `1px solid ${ADMIN.border}`,
            borderRadius: 8,
            background: ADMIN.surface,
            fontSize: 14,
            lineHeight: 1.5,
            color: ADMIN.ink900,
            whiteSpace: "pre-wrap",
          }}
        >
          {p.bio}
        </div>
      ) : null}

      <div
        style={{
          padding: 24,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <Field label="Пол" value={lf(GENDER, p.gender)} />
        <Field label="Город" value={p.city ? cityLabel(p.city, "ru") : "—"} />
        <Field label="Семейный статус" value={lf(MARITAL_STATUS, p.marital_status)} />
        <Field label="Дети" value={lf(HAS_CHILDREN, p.has_children)} />
        <Field label="Планы на детей" value={lf(CHILDREN_PLAN, p.children_plan)} />
        <Field label="Религия" value={lf(RELIGION, p.religion)} />
        <Field
          label="Важность религии"
          value={lf(RELIGION_IMPORTANCE, p.religion_importance)}
        />
        <Field label="Образование" value={lf(EDUCATION, p.education)} />
        <Field label="Занятость" value={lf(EMPLOYMENT, p.employment)} />
        <Field
          label="Ищет"
          value={
            p.looking_for_gender
              ? `${lf(GENDER, p.looking_for_gender)}${
                  p.partner_age_min || p.partner_age_max
                    ? ` · ${p.partner_age_min ?? "?"}–${p.partner_age_max ?? "?"} лет`
                    : ""
                }`
              : "—"
          }
        />
        <Field label="География поиска" value={lf(GEO_PREFERENCE, p.geo_preference)} />
        <Field
          label="Языки"
          value={p.languages?.length ? p.languages.join(", ") : "—"}
        />
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: ADMIN.ink500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          Ценности
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.values?.length ? (
            p.values.map((v) => (
              <span
                key={v}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: ADMIN.surface2,
                  border: `1px solid ${ADMIN.border}`,
                  fontSize: 12,
                  color: ADMIN.ink700,
                }}
              >
                {labelOf(LIFE_VALUES, v, "ru")}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 13, color: ADMIN.ink500 }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}
