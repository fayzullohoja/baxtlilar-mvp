"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "./Button";

/**
 * SEC-2b — клиентский flow enrollment 2FA: старт → показ секрета/ключа → ввод
 * кода из приложения → активация. QR не рисуем (без внешних зависимостей):
 * показываем otpauth-ссылку и ключ для ручного ввода в аутентификатор.
 */
export function TotpSetup({
  login,
  alreadyEnrolled,
}: {
  login: string;
  alreadyEnrolled: boolean;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/totp/enroll", { method: "POST" });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (data.ok) {
      setSecret(data.secret);
      setOtpauth(data.otpauth);
    } else {
      setError(
        data.error === "already_enrolled"
          ? "2FA уже включена для этого аккаунта."
          : "Не удалось начать настройку.",
      );
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/totp/enroll/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (data.ok) {
      setDone(true);
    } else {
      setError("Неверный код. Проверьте время на устройстве и попробуйте снова.");
    }
  }

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 460,
    background: ADMIN.surface,
    border: `1px solid ${ADMIN.border}`,
    borderRadius: 10,
    padding: 32,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: ADMIN.bg,
        fontFamily: ADMIN.fontSans,
        color: ADMIN.ink900,
      }}
    >
      <div style={card}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 8px" }}>
          Двухфакторная аутентификация
        </h1>
        <p style={{ fontSize: 13, color: ADMIN.ink500, margin: "0 0 24px" }}>
          Аккаунт: {login}
        </p>

        {done ? (
          <>
            <div
              style={{
                padding: "12px 14px",
                background: "#eefaf2",
                border: `1px solid ${ADMIN.accent}`,
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              2FA включена. При следующем входе понадобится код из приложения.
            </div>
            <Button variant="primary" onClick={() => router.push("/admin")}>
              В админку
            </Button>
          </>
        ) : alreadyEnrolled ? (
          <div style={{ fontSize: 14, color: ADMIN.ink700 }}>
            Для этого аккаунта 2FA уже включена. Чтобы сбросить — обратитесь к
            суперадмину.
          </div>
        ) : !secret ? (
          <>
            <p style={{ fontSize: 14, color: ADMIN.ink700, marginBottom: 20 }}>
              Понадобится приложение-аутентификатор (Google Authenticator, Aegis,
              1Password и т. п.). Нажмите, чтобы получить ключ.
            </p>
            {error ? <Err text={error} /> : null}
            <Button variant="primary" onClick={start} disabled={busy}>
              {busy ? "…" : "Начать настройку"}
            </Button>
          </>
        ) : (
          <form onSubmit={confirm}>
            <p style={{ fontSize: 13, color: ADMIN.ink700, marginBottom: 8 }}>
              Добавьте ключ в приложение (ручной ввод) или откройте ссылку:
            </p>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                background: ADMIN.bg,
                border: `1px solid ${ADMIN.border}`,
                borderRadius: 6,
                fontFamily: ADMIN.fontMono,
                fontSize: 14,
                letterSpacing: "0.12em",
                wordBreak: "break-all",
                marginBottom: 8,
              }}
            >
              {secret}
            </code>
            {otpauth ? (
              <a
                href={otpauth}
                style={{ fontSize: 12, color: ADMIN.accent, wordBreak: "break-all" }}
              >
                Открыть в приложении
              </a>
            ) : null}

            <div style={{ margin: "20px 0 16px" }}>
              <label
                htmlFor="code"
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: ADMIN.ink500,
                  marginBottom: 6,
                }}
              >
                Код из приложения
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                placeholder="000000"
                style={{
                  height: 40,
                  width: "100%",
                  padding: "0 12px",
                  fontFamily: ADMIN.fontMono,
                  fontSize: 18,
                  letterSpacing: "0.3em",
                  background: ADMIN.surface,
                  color: ADMIN.ink900,
                  border: `1px solid ${ADMIN.border}`,
                  borderRadius: 4,
                  outline: "none",
                }}
              />
            </div>
            {error ? <Err text={error} /> : null}
            <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
              {busy ? "Проверяем…" : "Включить 2FA"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

function Err({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 16,
        background: "#fcf0f3",
        border: `1px solid ${ADMIN.danger}`,
        borderRadius: 6,
        fontSize: 13,
        color: ADMIN.danger,
      }}
    >
      {text}
    </div>
  );
}
