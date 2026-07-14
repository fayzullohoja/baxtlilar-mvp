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
  const [showPw, setShowPw] = useState(true);
  // Креды последнего созданного аккаунта — показываем для передачи сотруднику
  // (на сервере пароль хешируется, повторно его увидеть уже нельзя).
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  function genPassword() {
    // читаемый набор без похожих символов (0/O, 1/l/I) — легче продиктовать
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint32Array(14);
    crypto.getRandomValues(buf);
    setPassword(Array.from(buf, (n) => chars[n % chars.length]).join(""));
    setShowPw(true);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard недоступен — пароль всё равно виден на экране, можно скопировать вручную */
    }
  }

  async function create() {
    const cred = { login: login.trim().toLowerCase(), password };
    const ok = await post("/api/admin/staff", { login, password, role }, "create");
    if (ok) {
      setCreated(cred);
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Логин">
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              style={{ ...input, width: 160 }}
              placeholder="напр. dilnoza"
              autoComplete="off"
            />
          </Field>
          <Field label="Пароль (мин. 8)">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...input, width: 190, fontFamily: ADMIN.fontMono }}
                type={showPw ? "text" : "password"}
                placeholder="пароль"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={iconBtn}
                title={showPw ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPw ? "Скрыть" : "Показать"}
              </button>
              <button
                type="button"
                onClick={genPassword}
                style={iconBtn}
                title="Сгенерировать надёжный пароль"
              >
                Сгенерировать
              </button>
            </div>
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
            {busyId === "create" ? "…" : "Создать аккаунт"}
          </Button>
        </div>
        <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 8 }}>
          Пароль показан, чтобы Вы могли передать его сотруднику. TOTP он подключит сам после первого входа.
        </div>
      </div>

      {/* Успех — креды для передачи (пароль на сервере хешируется, повторно не увидеть) */}
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
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: ADMIN.ink900 }}>
              ✓ Аккаунт «{created.login}» создан
            </div>
            <button type="button" onClick={() => setCreated(null)} style={iconBtn} title="Скрыть">
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={credBox}>
              {created.login} / {created.password}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy(`Логин: ${created.login}\nПароль: ${created.password}`)}
            >
              {copied ? "Скопировано ✓" : "Копировать"}
            </Button>
          </div>
          <div style={{ fontSize: 12, color: ADMIN.ink500, marginTop: 10 }}>
            Передайте эти данные сотруднику лично. Пароль больше нигде не отобразится — сохраните
            его сейчас.
          </div>
        </div>
      ) : null}

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
