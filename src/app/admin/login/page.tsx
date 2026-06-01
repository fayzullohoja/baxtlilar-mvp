"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-7 space-y-4"
      >
        <div>
          <h1 className="text-xl font-bold text-slate-900">Baxtlilar · Админ</h1>
          <p className="text-sm text-slate-500">Вход для модерации</p>
        </div>
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Логин"
          autoComplete="username"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !login || !password}
          className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
        >
          {busy ? "Вход…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
