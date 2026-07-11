import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";

// UX-NOTFOUND: аккуратный 404 админки (много notFound() в гейтах — напр.
// super-only страницы, несуществующий кейс/клиент). Раньше — дефолтный Next 404.
export default function AdminNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: ADMIN.bg,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 28,
          textAlign: "center",
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(15,23,30,0.06)",
        }}
      >
        <div style={{ fontSize: 32, fontFamily: ADMIN.fontMono, color: ADMIN.ink500 }}>404</div>
        <h1 style={{ fontSize: 17, fontWeight: 600, color: ADMIN.ink900, marginTop: 8 }}>
          Страница не найдена
        </h1>
        <p style={{ fontSize: 13, color: ADMIN.ink500, marginTop: 8, lineHeight: 1.5 }}>
          Такой страницы нет, либо у вас нет прав на её просмотр (некоторые разделы —
          только для суперадмина).
        </p>
        <div style={{ marginTop: 20 }}>
          <Link
            href="/admin"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
              background: ADMIN.accent,
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            На дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
