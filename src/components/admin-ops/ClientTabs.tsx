import Link from "next/link";
import { ADMIN } from "@/lib/admin/admin-tokens";

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "profile", label: "Profile" },
  { id: "photos", label: "Photos" },
  { id: "activity", label: "Activity" },
  { id: "moderation", label: "Moderation" },
] as const;

export function ClientTabs({
  clientId,
  active,
}: {
  clientId: string;
  active: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: `1px solid ${ADMIN.border}`,
        marginBottom: 24,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={`/admin/clients/${clientId}?tab=${t.id}`}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? ADMIN.ink900 : ADMIN.ink500,
              borderBottom: `2px solid ${isActive ? ADMIN.accent : "transparent"}`,
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
