import type { ReactNode } from "react";
import { OpsSidebar } from "./OpsSidebar";
import { OpsTopBar } from "./OpsTopBar";
import { loadAdminSettings } from "@/lib/admin/settings";
import { ADMIN } from "@/lib/admin/admin-tokens";

export async function OpsShell({
  adminName,
  adminRole,
  children,
}: {
  adminName: string;
  adminRole: "moderator" | "superadmin";
  children: ReactNode;
}) {
  // Волна 7 Фаза 3: баннер-объявление (super задаёт в /admin/settings) виден всем
  // админам на любой странице — единая точка провязки.
  const { bannerOn, bannerText } = await loadAdminSettings();

  return (
    <div
      data-ops="true"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      <OpsSidebar adminName={adminName} adminRole={adminRole} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <OpsTopBar />
        {bannerOn && bannerText ? (
          <div
            style={{
              padding: "8px 24px",
              background: "#fff7ed",
              borderBottom: `1px solid ${ADMIN.border}`,
              color: "#9a5b00",
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: "pre-wrap",
            }}
          >
            📢 {bannerText}
          </div>
        ) : null}
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
