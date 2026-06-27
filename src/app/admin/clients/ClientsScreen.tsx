"use client";
import { useState } from "react";
import { SearchBar } from "@/components/admin-ops/clients/SearchBar";
import { ClientsTable } from "@/components/admin-ops/clients/ClientsTable";
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { ClientRow } from "@/lib/admin/load-clients-search";

export function ClientsScreen({ initial }: { initial: ClientRow[] }) {
  // null = поиск не активен → показываем initial (последние зарегистрированные).
  const [results, setResults] = useState<ClientRow[] | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SearchBar onResults={setResults} />
      {results === null ? (
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
          Последние {initial.length} зарегистрированных. Начните вводить для
          поиска.
        </div>
      ) : null}
      <ClientsTable rows={results ?? initial} />
    </div>
  );
}
