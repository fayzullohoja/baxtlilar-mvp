"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { StatusPill } from "@/components/admin-ops/StatusPill";
import { Button } from "@/components/admin-ops/Button";
import { Dialog } from "@/components/admin-ops/Dialog";
import type { ClientRow } from "@/lib/admin/load-clients-search";

const th = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  color: ADMIN.ink500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 500,
};

// Построчные операторские действия «Сбросить онбординг» / «Удалить» прямо из
// списка пользователей (раньше только в карточке клиента → DangerZone). Список
// уже superadmin-only (page redirect), эндпоинты тоже superadmin-gated.
// Сброс работает на любой стадии онбординга (кроме blocked/pending_ban — гард
// от отмывания бана в RPC); для забаненного всегда есть Удаление.
type RowAction = { userId: string; name: string; kind: "restart" | "delete" };

const ERR_RU: Record<string, string> = {
  blocked_or_pending_ban:
    "Пользователь заблокирован или в ожидании бана — сброс недоступен. Используйте «Удалить» или сначала разбаньте.",
  reason_required: "Укажите причину (не короче 3 символов).",
  confirm_required: "Наберите слово подтверждения.",
  forbidden: "Нужны права суперадмина.",
  not_found: "Пользователь не найден (возможно, уже удалён).",
  internal: "Внутренняя ошибка сервера.",
  network: "Сеть недоступна.",
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();
  const [action, setAction] = useState<RowAction | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start(a: RowAction) {
    setAction(a);
    setReason("");
    setTyped("");
    setError(null);
  }

  async function run() {
    if (!action) return;
    const isDelete = action.kind === "delete";
    setBusy(true);
    setError(null);
    try {
      const path = isDelete
        ? `/api/admin/users/${action.userId}/delete`
        : `/api/admin/users/${action.userId}/restart-onboarding`;
      const body = isDelete
        ? { confirm: "DELETE", reason: reason.trim() }
        : { reason: reason.trim() };
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (d.ok) {
        setAction(null);
        router.refresh();
      } else {
        setError(ERR_RU[d.error ?? ""] ?? d.error ?? "unknown");
        setBusy(false);
      }
    } catch {
      setError(ERR_RU.network);
      setBusy(false);
    }
  }

  const isDelete = action?.kind === "delete";
  const canSubmit =
    !busy && reason.trim().length >= 3 && (!isDelete || typed === "УДАЛИТЬ");

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          color: ADMIN.ink500,
          fontSize: 13,
          textAlign: "center",
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 8,
          background: ADMIN.surface,
        }}
      >
        Ничего не найдено
      </div>
    );
  }

  return (
    <>
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
            {["", "ФИО", "Возраст", "Город", "Телефон", "TG", "Статус", "Создан", "Действия"].map(
              (h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = r.full_name ?? r.display_name ?? "—";
            return (
              <tr
                key={r.user_id}
                style={{ borderBottom: `1px solid ${ADMIN.border}` }}
              >
                <td style={{ padding: "8px 12px" }}>
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar_url}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: ADMIN.surface2,
                        color: ADMIN.ink300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                  <Link
                    href={`/admin/clients/${r.user_id}`}
                    style={{ color: ADMIN.ink900, textDecoration: "none" }}
                  >
                    {name}
                  </Link>
                  {r.pinfl ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: ADMIN.ink500,
                        fontFamily: ADMIN.fontMono,
                      }}
                    >
                      {r.pinfl}
                    </div>
                  ) : null}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: ADMIN.ink700,
                  }}
                >
                  {r.age ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: ADMIN.ink700,
                  }}
                >
                  {r.city ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    fontFamily: ADMIN.fontMono,
                    color: ADMIN.ink500,
                  }}
                >
                  {r.phone_number_masked ?? "—"}
                </td>
                <td
                  style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}
                >
                  {r.telegram_username ? `@${r.telegram_username}` : "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {r.lifecycle_state === "blocked" ? (
                    <StatusPill kind="banned">заблокирован</StatusPill>
                  ) : r.verification_status === "approved" ? (
                    <StatusPill kind="verified">approved</StatusPill>
                  ) : (
                    <StatusPill kind="pending">{r.verification_status}</StatusPill>
                  )}
                </td>
                <td
                  style={{ padding: "10px 12px", fontSize: 12, color: ADMIN.ink500 }}
                >
                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => start({ userId: r.user_id, name, kind: "restart" })}
                      title="Сбросить онбординг — сотрёт анкету/фото/паспорт/согласия, TG сохранится"
                    >
                      Сбросить
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => start({ userId: r.user_id, name, kind: "delete" })}
                      title="Удалить навсегда — полное удаление из системы"
                    >
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {action ? (
        <Dialog
          open
          onClose={() => (busy ? undefined : setAction(null))}
          title={
            isDelete
              ? `Удалить «${action.name}» навсегда?`
              : `Сбросить онбординг «${action.name}»?`
          }
          actions={
            <>
              <Button onClick={() => setAction(null)} disabled={busy}>
                Отмена
              </Button>
              <Button variant="danger" onClick={run} disabled={!canSubmit}>
                {busy ? "…" : isDelete ? "Удалить навсегда" : "Сбросить"}
              </Button>
            </>
          }
        >
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 14,
              borderRadius: 6,
              background: "#fcf0f3",
              border: `1px solid ${ADMIN.danger}`,
              fontSize: 13,
              color: ADMIN.danger,
            }}
          >
            {isDelete
              ? "НЕОБРАТИМО. Полностью удаляет пользователя из системы. При следующем /start он зарегистрируется как новый — мы о нём ничего знать не будем."
              : "Сотрёт анкету, фото, паспорт, квиз и СОГЛАСИЯ. Telegram-аккаунт сохранится, пользователь пройдёт онбординг заново с чистого листа. (Заблокированного нельзя сбросить — используйте «Удалить».)"}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Причина</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              style={inputStyle}
              autoFocus
            />
          </div>

          {isDelete ? (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Наберите «УДАЛИТЬ» для подтверждения</label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                style={inputStyle}
              />
            </div>
          ) : null}

          {error ? (
            <div style={{ fontSize: 13, color: ADMIN.danger }}>Ошибка: {error}</div>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: ADMIN.fontSans,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
};
