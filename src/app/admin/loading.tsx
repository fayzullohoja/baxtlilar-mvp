import { ADMIN } from "@/lib/admin/admin-tokens";

// UX-LOADING: скелет на время загрузки данных страницы админки (route-level
// Suspense fallback). Раньше был пустой белый экран между навигациями.
export default function AdminLoading() {
  return (
    <div style={{ padding: 32, minHeight: "100vh", background: ADMIN.bg }}>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes bxsk{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}.bxsk{animation:bxsk 1.2s ease-in-out infinite}",
        }}
      />
      <Bar w={180} h={22} mb={6} />
      <Bar w={280} h={13} mb={24} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bxsk"
            style={{
              height: 88,
              borderRadius: 8,
              background: ADMIN.surface,
              border: `1px solid ${ADMIN.border}`,
            }}
          />
        ))}
      </div>
      <div
        className="bxsk"
        style={{
          height: 220,
          borderRadius: 8,
          background: ADMIN.surface,
          border: `1px solid ${ADMIN.border}`,
        }}
      />
    </div>
  );
}

function Bar({ w, h, mb }: { w: number; h: number; mb: number }) {
  return (
    <div
      className="bxsk"
      style={{
        width: w,
        height: h,
        marginBottom: mb,
        borderRadius: 4,
        background: ADMIN.surface2,
      }}
    />
  );
}
