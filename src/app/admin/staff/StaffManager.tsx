"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { StatusPill } from "@/components/admin-ops/StatusPill";

export type StaffRow = {
  id: string;
  login: string;
  role: "superadmin" | "moderator";
  active: boolean;
  created_at: string;
  totp: boolean;
};

const ERR_RU: Record<string, string> = {
  self_deactivate: "Нельзя деактивировать самого себя.",
  self_demote: "Нельзя разжаловать самого себя.",
  last_superadmin: "Это последний активный суперадмин — действие запрещено.",
  login_taken: "Логин уже занят.",
  weak_password: "Пароль слишком короткий (мин. 8 символов).",
  bad_login: "Логин слишком короткий (мин. 3 символа).",
  bad_role: "Некорректная роль.",
  not_found: "Аккаунт не найден.",
  internal: "Внутренняя ошибка.",
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

export function StaffManager({
  rows,
  currentAdminId,
}: {
  rows: StaffRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Форма создания
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"superadmin" | "moderator">("moderator");

  async function post(url: string, body: unknown, busyKey: string): Promise<boolean> {
    setBusyId(busyKey);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        router.refresh();
        return true;
      }
      setError(ERR_RU[d.error ?? ""] ?? d.error ?? "error");
      return false;
    } catch {
      setError(ERR_RU.network);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function create() {
    const ok = await post("/api/admin/staff", { login, password, role }, "create");
    if (ok) {
      setLogin("");
      setPassword("");
      setRole("moderator");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Создание */}
      <div style={card}>
        <div style={cardLabel}>Создать аккаунт</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Логин">
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              style={input}
              placeholder="логин"
              autoComplete="off"
            />
          </Field>
          <Field label="Пароль (мин. 8)">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              type="password"
              placeholder="временный пароль"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Роль">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "superadmin" | "moderator")}
              style={input}
            >
              <option value="moderator">Модератор</option>
              <option value="superadmin">Суперадмин</option>
            </select>
          </Field>
          <Button
            variant="primary"
            disabled={busyId === "create" || login.trim().length < 3 || password.length < 8}
            onClick={create}
          >
            {busyId === "create" ? "…" : "Создать"}
          </Button>
        </div>
        <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 8 }}>
          Пароль передайте сотруднику лично. TOTP он подключит сам после первого входа.
        </div>
      </div>

      {error ? (
        <div style={{ fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</div>
      ) : null}

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
            {["Логин", "Роль", "Статус", "2FA", "Создан", "Действия"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSelf = r.id === currentAdminId;
            const busy = busyId === r.id;
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${ADMIN.border}`, opacity: r.active ? 1 : 0.55 }}>
                <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: ADMIN.fontMono }}>
                  {r.login}
                  {isSelf ? <span style={{ color: ADMIN.ink500 }}> (вы)</span> : null}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <StatusPill kind={r.role === "superadmin" ? "verified" : "new"}>
                    {r.role === "superadmin" ? "суперадмин" : "модератор"}
                  </StatusPill>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {r.active ? (
                    <StatusPill kind="verified">активен</StatusPill>
                  ) : (
                    <StatusPill kind="banned">деактивирован</StatusPill>
                  )}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                  {r.totp ? "✓" : "—"}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}>
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* Смена роли */}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || (isSelf && r.role === "superadmin")}
                      title={isSelf && r.role === "superadmin" ? "Нельзя разжаловать себя" : undefined}
                      onClick={() =>
                        post(
                          `/api/admin/staff/${r.id}/role`,
                          { role: r.role === "superadmin" ? "moderator" : "superadmin" },
                          r.id,
                        )
                      }
                    >
                      {r.role === "superadmin" ? "→ модератор" : "→ суперадмин"}
                    </Button>
                    {/* Активность */}
                    <Button
                      size="sm"
                      variant={r.active ? "danger" : "secondary"}
                      disabled={busy || (isSelf && r.active)}
                      title={isSelf && r.active ? "Нельзя деактивировать себя" : undefined}
                      onClick={() =>
                        post(`/api/admin/staff/${r.id}/active`, { active: !r.active }, r.id)
                      }
                    >
                      {r.active ? "Деактивировать" : "Реактивировать"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
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
