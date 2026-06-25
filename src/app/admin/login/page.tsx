"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * V2 Admin Login (Blueprint §4.1).
 *
 * Editorial DNA: paper фон, serif Headline, underline inputs, ink button.
 * Без shadow card — просто чистая форма по центру.
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
        padding: "24px",
        background: "var(--color-v2-paper)",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: "380px",
        }}
      >
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "10px",
            }}
          >
            Baxtlilar · Админ-панель
          </div>
          <h1
            style={{
              fontFamily: "var(--font-v2-display)",
              fontSize: "32px",
              lineHeight: "1.15",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--color-v2-ink-100)",
              margin: 0,
            }}
          >
            Вход для модерации.
          </h1>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "8px",
            }}
          >
            Логин
          </label>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "32px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-v2-ink-400)",
              marginBottom: "8px",
            }}
          >
            Пароль
          </label>
          <input
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
              marginBottom: "16px",
              background: "rgba(180, 50, 50, 0.08)",
              border: "1px solid rgba(180, 50, 50, 0.3)",
              borderRadius: "var(--v2-radius-md)",
              fontSize: "13px",
              color: "var(--color-v2-ink-200)",
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || !login || !password}
          style={{
            width: "100%",
            padding: "14px 24px",
            fontFamily: "var(--font-v2-body)",
            fontSize: "15px",
            fontWeight: 500,
            color: "var(--color-v2-paper)",
            background: "var(--color-v2-ink-100)",
            border: "none",
            borderRadius: "var(--v2-radius-md)",
            cursor: busy || !login || !password ? "not-allowed" : "pointer",
            opacity: busy || !login || !password ? 0.4 : 1,
            transition: "background 0.12s ease",
          }}
        >
          {busy ? "Вход…" : "Войти"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 0 12px",
  fontFamily: "var(--font-v2-body)",
  fontSize: "17px",
  color: "var(--color-v2-ink-100)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-v2-ink-500)",
  outline: "none",
  borderRadius: 0,
};
