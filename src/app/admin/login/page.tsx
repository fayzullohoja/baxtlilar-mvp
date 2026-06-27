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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (data.ok) {
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
        onSubmit={submit}
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
            Вход для модерации
          </h1>
        </div>

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
          disabled={busy || !login || !password}
          style={{
            width: "100%",
            height: 40,
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          {busy ? "Вход…" : "Войти"}
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
