"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";

/**
 * Граница ошибок админки. Страницы админки намеренно «падают громко» при сбое БД
 * (см. unwrap* / итерации 1 и 8: лучше видимая ошибка, чем тихий «0 заявок»). Без
 * этой границы такой throw показывал бы сырую страницу ошибки Next без кнопки
 * повтора. Здесь — аккуратный экран с «Повторить» (reset) и возвратом на дашборд.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Не удалось загрузить страницу</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ошибка при обращении к базе данных. Нажмите «Повторить» — если повторяется,
          проверьте доступность БД и логи сервиса.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-slate-400">код: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ background: ADMIN.accent }}
          >
            Повторить
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            На дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
