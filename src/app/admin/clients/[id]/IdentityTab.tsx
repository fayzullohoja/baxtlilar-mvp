import { ADMIN } from "@/lib/admin/admin-tokens";
import type { LoadedClient } from "@/lib/admin/load-client";

export function IdentityTab({
  identity,
}: {
  identity: LoadedClient["identity"];
}) {
  if (!identity) {
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
        Паспортные данные ещё не введены. Откройте кейс верификации и пройдите
        3-step studio.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${ADMIN.border}`,
        borderRadius: 8,
        background: ADMIN.surface,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 16,
        }}
      >
        Identity facts
      </div>

      <Section title="ФИО">
        <Row label="Фамилия" value={identity.last_name} verified />
        <Row label="Имя" value={identity.first_name} verified />
        {identity.middle_name ? (
          <Row label="Отчество" value={identity.middle_name} verified />
        ) : null}
      </Section>

      <Section title="Личность">
        <Row
          label="Дата рождения"
          value={new Date(identity.birth_date).toLocaleDateString("ru-RU")}
          verified
        />
        <Row label="Пол" value={identity.gender} verified />
        <Row label="Гражданство" value={identity.citizenship} verified />
        <Row label="Место рождения" value={identity.birth_place} verified />
      </Section>

      <Section title="Документ">
        <Row label="ПИНФЛ" value={identity.pinfl} mono verified />
        <Row
          label="Паспорт"
          value={`${identity.passport_series}${identity.passport_number}`}
          mono
          verified
        />
        <Row label="Кем выдан" value={identity.issued_by} />
        <Row
          label="Дата выдачи"
          value={new Date(identity.issued_at).toLocaleDateString("ru-RU")}
        />
        <Row
          label="Срок действия"
          value={new Date(identity.expires_at).toLocaleDateString("ru-RU")}
        />
      </Section>

      <Section title="Прописка">
        <Row
          label="Регион"
          value={`${identity.region_code} / ${identity.district_code}`}
        />
        <Row
          label="Адрес"
          value={`${identity.locality}, ${identity.street_address}`}
        />
      </Section>

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: `1px solid ${ADMIN.border}`,
          fontSize: 12,
          color: ADMIN.ink500,
        }}
      >
        Verified by {identity.enterer_login ?? "—"} ·{" "}
        {new Date(identity.entered_at).toLocaleString("ru-RU")}
        {identity.source_case_id
          ? ` · case VR-${identity.source_case_id.slice(0, 8)}`
          : ""}
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
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: ADMIN.ink500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  verified,
  mono,
}: {
  label: string;
  value: string;
  verified?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr 90px",
        gap: 12,
        fontSize: 13,
        alignItems: "center",
      }}
    >
      <div style={{ color: ADMIN.ink500 }}>{label}</div>
      <div
        style={{
          color: ADMIN.ink900,
          fontFamily: mono ? ADMIN.fontMono : ADMIN.fontSans,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: verified ? ADMIN.success : ADMIN.ink300,
          fontSize: 11,
        }}
      >
        {verified ? "🛡 verified" : ""}
      </div>
    </div>
  );
}
