"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN } from "@/lib/admin/admin-tokens";
import { Button } from "@/components/admin-ops/Button";

/**
 * Admin Login (OpsShell aesthetic, pre-auth standalone — no sidebar).
 *
 * ADMIN.bg фон, Inter, центрированная карточка на ADMIN.surface с ADMIN.border,
 * slate-blue primary-кнопка, поля как admin-ops Field.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SEC-2c: двухшаговый вход — 'password' → (если enrolled) 'totp'.
  const [stage, setStage] = useState<"password" | "totp">("password");
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Без try/catch сетевой сбой оставлял busy=true навсегда: форма входа
    // блокировалась без единого сообщения, помогала только перезагрузка.
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok && data.totp_required) {
        setStage("totp");
        setBusy(false);
      } else if (data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(
          data.error === "throttled"
            ? "Слишком много попыток. Подождите 15 минут."
            : "Неверный логин или пароль.",
        );
        setBusy(false);
      }
    } catch {
      setError("Сеть недоступна. Проверьте соединение и повторите.");
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(
          data.error === "throttled"
            ? "Слишком много попыток. Подождите."
            : data.error === "no_pending"
              ? "Сессия входа истекла. Начните заново."
              : "Неверный код. Попробуйте ещё раз.",
        );
        setBusy(false);
      }
    } catch {
      setError("Сеть недоступна. Проверьте соединение и повторите.");
      setBusy(false);
    }
  }

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
      <form
        onSubmit={stage === "password" ? submit : submitCode}
        style={{
          width: "100%",
          maxWidth: 380,
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 10,
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: ADMIN.ink500,
              marginBottom: 10,
            }}
          >
            Baxtlilar · Админ-панель
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            {stage === "password" ? "Вход для модерации" : "Код подтверждения"}
          </h1>
          {stage === "totp" ? (
            <p style={{ fontSize: 13, color: ADMIN.ink500, margin: "8px 0 0" }}>
              Введите 6-значный код из приложения-аутентификатора.
            </p>
          ) : null}
        </div>

        {stage === "password" ? (
          <>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="login" style={labelStyle}>
                Логин
              </label>
              <input
                id="login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password" style={labelStyle}>
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="code" style={labelStyle}>
              Код
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              style={{ ...inputStyle, letterSpacing: "0.3em", fontSize: 18 }}
            />
          </div>
        )}

        {error ? (
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
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          disabled={
            busy ||
            (stage === "password" ? !login || !password : code.length !== 6)
          }
          style={{
            width: "100%",
            height: 40,
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          {busy ? "Проверяем…" : stage === "password" ? "Войти" : "Подтвердить"}
        </Button>
      </form>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: ADMIN.ink500,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  height: 36,
  width: "100%",
  padding: "0 10px",
  fontFamily: ADMIN.fontSans,
  fontSize: 14,
  background: ADMIN.surface,
  color: ADMIN.ink900,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: 4,
  outline: "none",
};
