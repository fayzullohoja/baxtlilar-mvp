"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";
import { Dialog } from "@/components/admin-ops/Dialog";
import { useAsyncAction, postAdminAction } from "@/lib/admin/use-async-action";
import { ADMIN_ERROR_RU as ERR_RU } from "@/lib/admin/labels";

// DZ-1/2/3 — операторские действия над аккаунтом (только superadmin).
// Бэк ban(two-person)/unban/unblock-verification уже готов; restart/hard-delete —
// новые RPC. Каждое действие через confirm-диалог + причина; delete требует
// набрать «УДАЛИТЬ». router.refresh() после успеха.

type Props = {
  userId: string;
  lifecycleState: string;
  verificationStatus: string;
  pendingBan: { at: string; byAdminId: string; reason: string | null } | null;
  currentAdminId: string;
};

type Kind =
  | "ban_propose"
  | "ban_confirm"
  | "ban_cancel"
  | "unban"
  | "unblock_verif"
  | "restart"
  | "delete";

type Cfg = {
  title: string;
  warn?: string;
  needsReason?: boolean;
  typedConfirm?: string; // если задано — надо набрать это слово
  path: (id: string) => string;
  body: (reason: string) => Record<string, unknown>;
  cta: string;
};

const ACTIONS: Record<Kind, Cfg> = {
  ban_propose: {
    title: "Предложить бан",
    warn: "Невидимое предложение (юзер не узнает). Подтвердит второй суперадмин в течение 24ч.",
    needsReason: true,
    path: (id) => `/api/admin/users/${id}/ban`,
    body: (reason) => ({ action: "propose", reason }),
    cta: "Предложить",
  },
  ban_confirm: {
    title: "Подтвердить бан",
    warn: "Аккаунт станет заблокированным.",
    path: (id) => `/api/admin/users/${id}/ban`,
    body: () => ({ action: "confirm" }),
    cta: "Подтвердить",
  },
  ban_cancel: {
    title: "Отменить предложение бана",
    path: (id) => `/api/admin/users/${id}/ban`,
    body: () => ({ action: "cancel" }),
    cta: "Отменить бан",
  },
  unban: {
    title: "Разбанить",
    warn: "Вернёт аккаунт в активное состояние.",
    path: (id) => `/api/admin/users/${id}/unban`,
    body: () => ({}),
    cta: "Разбанить",
  },
  unblock_verif: {
    title: "Откатить блокировку верификации",
    warn: "Вернёт на проверку и очистит чёрные списки (паспорт/телефон).",
    path: (id) => `/api/admin/users/${id}/unblock-verification`,
    body: () => ({}),
    cta: "Откатить",
  },
  restart: {
    title: "Сбросить онбординг",
    warn: "Сотрёт анкету, фото, паспорт и СОГЛАСИЯ. Telegram-аккаунт сохранится, юзер пройдёт всё заново.",
    needsReason: true,
    path: (id) => `/api/admin/users/${id}/restart-onboarding`,
    body: (reason) => ({ reason }),
    cta: "Сбросить",
  },
  delete: {
    title: "Удалить аккаунт навсегда",
    warn: "НЕОБРАТИМО. Полное удаление всех данных пользователя из системы.",
    needsReason: true,
    typedConfirm: "УДАЛИТЬ",
    path: (id) => `/api/admin/users/${id}/delete`,
    body: (reason) => ({ confirm: "DELETE", reason }),
    cta: "Удалить навсегда",
  },
};

export function DangerZone({
  userId,
  lifecycleState,
  verificationStatus,
  pendingBan,
  currentAdminId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  // busy/error — через общий примитив: он снимает busy и на успехе тоже.
  // Раньше здесь busy сбрасывался только в ветке ошибки, и после первого
  // удачного действия вся danger-zone оставалась заблокированной до F5.
  const { busy, error, setError, run: runAction } = useAsyncAction();

  function start(k: Kind) {
    setOpen(k);
    setReason("");
    setTyped("");
    setError(null);
  }

  async function run() {
    if (!open) return;
    const cfg = ACTIONS[open];
    await runAction(async () => {
      await postAdminAction(cfg.path(userId), cfg.body(reason.trim()), ERR_RU);
      setOpen(null);
      router.refresh();
    });
  }

  const cfg = open ? ACTIONS[open] : null;
  const canSubmit =
    !busy &&
    (!cfg?.needsReason || reason.trim().length >= 3) &&
    (!cfg?.typedConfirm || typed === cfg.typedConfirm);

  const isProposer = pendingBan?.byAdminId === currentAdminId;

  return (
    <div style={box}>
      <div style={header}>Опасная зона</div>

      {/* Блокировка */}
      <Row label="Блокировка">
        {pendingBan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: ADMIN.ink700 }}>
              Предложен бан{pendingBan.reason ? ` · ${pendingBan.reason}` : ""} · ожидает 2-го суперадмина
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="danger"
                disabled={isProposer}
                onClick={() => start("ban_confirm")}
                title={isProposer ? "Нельзя подтвердить своё предложение" : undefined}
              >
                Подтвердить бан
              </Button>
              <Button onClick={() => start("ban_cancel")}>Отменить предложение</Button>
            </div>
            {isProposer ? (
              <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
                Вы автор предложения — подтвердить должен другой суперадмин.
              </div>
            ) : null}
          </div>
        ) : lifecycleState === "blocked" ? (
          <Button onClick={() => start("unban")}>Разбанить</Button>
        ) : (
          <Button variant="danger" onClick={() => start("ban_propose")}>
            Предложить бан
          </Button>
        )}
      </Row>

      {/* Откат blocking-reject */}
      {lifecycleState === "blocked" && verificationStatus === "rejected" ? (
        <Row label="Верификация">
          <Button onClick={() => start("unblock_verif")}>Откатить блокировку</Button>
        </Row>
      ) : null}

      {/* Рестарт онбординга */}
      <Row label="Онбординг">
        <Button onClick={() => start("restart")}>Сбросить онбординг (стирает согласия)</Button>
      </Row>

      {/* Удаление */}
      <Row label="Удаление">
        <Button variant="danger" onClick={() => start("delete")}>
          Удалить аккаунт навсегда
        </Button>
      </Row>

      {cfg ? (
        <Dialog
          open
          onClose={() => (busy ? undefined : setOpen(null))}
          title={cfg.title}
          actions={
            <>
              <Button onClick={() => setOpen(null)} disabled={busy}>
                Отмена
              </Button>
              <Button variant="danger" onClick={run} disabled={!canSubmit}>
                {busy ? "…" : cfg.cta}
              </Button>
            </>
          }
        >
          {cfg.warn ? (
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
              {cfg.warn}
            </div>
          ) : null}

          {cfg.needsReason ? (
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
          ) : null}

          {cfg.typedConfirm ? (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>
                Наберите «{cfg.typedConfirm}» для подтверждения
              </label>
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
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "12px 0",
        borderTop: `1px solid ${ADMIN.border}`,
      }}
    >
      <div style={{ width: 120, fontSize: 12, color: ADMIN.ink500, paddingTop: 6 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const box: React.CSSProperties = {
  marginTop: 32,
  padding: 20,
  border: `1px solid ${ADMIN.danger}`,
  borderRadius: 8,
  background: ADMIN.surface,
};

const header: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.danger,
  marginBottom: 4,
};

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
