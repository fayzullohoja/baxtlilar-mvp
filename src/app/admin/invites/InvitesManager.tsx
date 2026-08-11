"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import type { InviteRow } from "@/lib/admin/load-invites";

const ERR_RU: Record<string, string> = {
  forbidden: "Недостаточно прав.",
  not_found: "Код не найден.",
  already_disabled: "Код уже погашен.",
  no_owner: "У мастер-кода нет владельца - снимать запрет не с кого.",
  not_leak: "Восстановить можно только код, погашенный за утечку из этого раздела.",
  label_required: "Укажите, зачем нужен мастер-код.",
  // Раунд исправлений 1: раньше текст утверждал "строка НЕ изменена" - это
  // была ложь при частичном сбое старой (нетранзакционной) версии гашения.
  // Гашение теперь атомарно (RPC disable_invite_codes_of_user, миграция
  // 20260811160000), но эта же строка используется и другими действиями
  // (восстановление, выпуск мастер-кода) - формулировка нейтральная, без
  // утверждений о том, что именно осталось или не осталось в БД.
  internal: "Не удалось выполнить действие - попробуйте ещё раз.",
  network: "Сеть недоступна.",
};

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

export function InvitesManager({ rows }: { rows: InviteRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<{ code: string; label: string } | null>(null);

  async function post(url: string, body: unknown, busyKey: string): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    setBusyId(busyKey);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
      if (d.ok) {
        router.refresh();
        return { ok: true, data: d };
      }
      // ⛔ Второе предупреждение ревью Task 8: провал обязан быть ВИДЕН
      // оператору - именно поэтому здесь всегда показываем текст ошибки, а не
      // молча router.refresh() как при успехе. Строка в таблице ниже НЕ
      // считается изменённой, пока не пришёл ok:true.
      setError(ERR_RU[d.error ?? ""] ?? d.error ?? "internal");
      return { ok: false, data: d };
    } catch {
      setError(ERR_RU.network);
      return { ok: false, data: {} };
    } finally {
      setBusyId(null);
    }
  }

  async function createMaster() {
    const { ok, data } = await post("/api/admin/invites", { label }, "create");
    if (ok) {
      setCreated({ code: String(data.code ?? ""), label });
      setLabel("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Создание мастер-кода */}
      <div style={card}>
        <div style={cardLabel}>Выпустить мастер-код</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Зачем он (обязательно)">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{ ...input, width: 320 }}
              placeholder="напр. Встреча в Ташкенте 20.08"
              autoComplete="off"
            />
          </Field>
          <Button
            variant="primary"
            disabled={busyId === "create" || label.trim().length === 0}
            onClick={createMaster}
          >
            {busyId === "create" ? "…" : "Выпустить"}
          </Button>
        </div>
        <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 8 }}>
          Мастер-код не привязан к человеку и обходит шлагбаум для любого числа
          людей - подпись обязательна, чтобы через полгода в списке было понятно,
          зачем он вообще существует.
        </div>
      </div>

      {created ? (
        <div
          style={{
            padding: 14,
            border: `1px solid ${ADMIN.success}`,
            borderRadius: 8,
            background: "rgba(47, 122, 78, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: ADMIN.ink900 }}>
              ✓ Мастер-код «{created.label}» выпущен
            </div>
            <button type="button" onClick={() => setCreated(null)} style={iconBtn} title="Скрыть">
              ✕
            </button>
          </div>
          <code style={credBox}>{created.code}</code>
        </div>
      ) : null}

      {error ? <div style={{ fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</div> : null}

      {/* Список */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
            {["Код", "Чей", "Привёл", "Статус", "Выпущен", "Действия"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 24, textAlign: "center", color: ADMIN.ink500, fontSize: 13 }}>
                Кодов пока нет.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const busy = busyId === r.id;
              const isMaster = !r.owner_id;
              const canRestore = r.disabled_reason === "leak" && !!r.owner_id;
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${ADMIN.border}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: ADMIN.fontMono }}>{r.code}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>
                    {isMaster ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <StatusPill kind="new">мастер-код</StatusPill>
                        {r.label ? <span style={{ color: ADMIN.ink700 }}>{r.label}</span> : null}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/admin/clients/${r.owner_id}`} style={{ color: ADMIN.accent }}>
                          {r.owner_login ?? "без имени"}
                        </Link>
                        {r.owner_invite_revoked ? (
                          <StatusPill kind="warning">право закрыто</StatusPill>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>{r.invited}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.disabled_at ? (
                      <StatusPill kind="banned">погашен{r.disabled_reason ? ` · ${r.disabled_reason}` : ""}</StatusPill>
                    ) : (
                      <StatusPill kind="active">активен</StatusPill>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                    {new Date(r.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!r.disabled_at ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => post(`/api/admin/invites/${r.id}/disable`, {}, r.id)}
                        >
                          {busy ? "…" : "Погасить"}
                        </Button>
                      ) : null}
                      {canRestore ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => post(`/api/admin/invites/${r.id}/restore`, {}, r.id)}
                        >
                          {busy ? "…" : "Восстановить право"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: ADMIN.ink500 }}>{label}</label>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 8,
  background: ADMIN.surface,
};
const cardLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 12,
};
const input: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: ADMIN.fontSans,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
};
const iconBtn: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  fontSize: 12,
  fontFamily: ADMIN.fontSans,
  color: ADMIN.ink700,
  background: ADMIN.surface2,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const credBox: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: ADMIN.fontMono,
  color: ADMIN.ink900,
  background: ADMIN.surface,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  userSelect: "all",
};
