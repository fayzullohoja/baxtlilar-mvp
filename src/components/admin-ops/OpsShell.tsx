import type { ReactNode } from "react";
import { OpsSidebar } from "./OpsSidebar";
import { OpsTopBar } from "./OpsTopBar";

export function OpsShell({
  adminName,
  adminRole,
  children,
}: {
  adminName: string;
  adminRole: "moderator" | "superadmin";
  children: ReactNode;
}) {
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
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
