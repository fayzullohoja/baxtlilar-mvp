"use client";

import { useEffect } from "react";

/**
 * Глобальная граница ошибок: срабатывает, когда падает сам корневой layout (когда
 * обычные error.tsx сегментов уже не помогают). Заменяет корневой layout, поэтому
 * обязана отрисовать <html>/<body> и не может опираться на глобальный CSS — стили
 * инлайновые, фирменный коралл #E2526B.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root error:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8fafc",
        }}
      >
        <div style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, color: "#0f172a", margin: 0 }}>Что-то пошло не так</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              background: "#E2526B",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
