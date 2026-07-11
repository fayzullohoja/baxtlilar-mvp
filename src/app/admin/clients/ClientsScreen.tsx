"use client";
import { useEffect, useState } from "react";
import { SearchBar } from "@/components/admin-ops/clients/SearchBar";
import { ClientsTable } from "@/components/admin-ops/clients/ClientsTable";
import { Button } from "@/components/admin-ops/Button";
import { ADMIN } from "@/lib/admin/admin-tokens";
import type { ClientRow, ClientFilters } from "@/lib/admin/load-clients-search";

// Поисковый стейт помечен запросом `q`, под который он получен. Рендер и
// load-more сверяют его с текущим q → устаревшие/гоночные ответы не подмешиваются
// (cross-query mixing) и не «мигают» под новым запросом.
type SearchState = { q: string; rows: ClientRow[]; hasMore: boolean };

/**
 * Директория клиентов: серверный первый лист (`initial`) + type-ahead поиск +
 * «Показать ещё» (offset-пагинация) для обоих режимов. Фильтры директории
 * (status/gender/verification) уходят и в поиск, и в load-more — компонуются.
 *
 * Родитель монтирует с key по фильтрам → смена фильтра = свежий remount, старые
 * дозагруженные страницы не протекают в новый фильтр.
 */
export function ClientsScreen({
  initial,
  hasMore,
  filters,
  filtered = false,
}: {
  initial: ClientRow[];
  hasMore: boolean;
  filters: ClientFilters;
  filtered?: boolean;
}) {
  const [q, setQ] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState<SearchState | null>(null);
  // Дозагруженные страницы директории (q == '').
  const [dirExtra, setDirExtra] = useState<ClientRow[]>([]);
  const [dirHasMore, setDirHasMore] = useState(hasMore);

  const status = filters.status ?? "all";
  const gender = filters.gender ?? "all";
  const verification = filters.verification ?? "all";

  function buildUrl(query: string, offset: number): string {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    p.set("offset", String(offset));
    if (status !== "all") p.set("status", status);
    if (gender !== "all") p.set("gender", gender);
    if (verification !== "all") p.set("verification", verification);
    return `/api/admin/clients/search?${p.toString()}`;
  }

  async function fetchPage(query: string, offset: number): Promise<Omit<SearchState, "q">> {
    const r = await fetch(buildUrl(query, offset));
    const d = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      rows?: ClientRow[];
      hasMore?: boolean;
    };
    return { rows: d.rows ?? [], hasMore: !!d.hasMore };
  }

  // Type-ahead: фетчим ТОЛЬКО при непустом q. Пустой q → рендер показывает
  // директорию (без setState-in-effect). cancelled гасит гонку дебаунса.
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const page = await fetchPage(query, 0);
      if (!cancelled) setSearch({ q: query, ...page });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // status/gender/verification стабильны в пределах mount (родитель remount'ит
    // по key при их смене) — включены для полноты зависимостей.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, gender, verification]);

  const query = q.trim();
  const isSearch = query.length > 0;
  // Показываем поисковый стейт ТОЛЬКО если он под текущий q (иначе — идёт загрузка).
  const activeSearch = search && search.q === query ? search : null;
  const rows = isSearch ? (activeSearch?.rows ?? []) : [...initial, ...dirExtra];
  const showMore = isSearch ? (activeSearch?.hasMore ?? false) : dirHasMore;
  // busy — производное: ищем, но результата под текущий q ещё нет. Не залипает.
  const busy = isSearch && activeSearch === null;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await fetchPage(query, rows.length);
      if (isSearch) {
        setSearch((prev) => {
          // Запрос сменился, пока грузили страницу → не подмешиваем чужие строки.
          if (!prev || prev.q !== query) return prev;
          return { q: query, rows: [...prev.rows, ...page.rows], hasMore: page.hasMore };
        });
      } else {
        setDirExtra((prev) => [...prev, ...page.rows]);
        setDirHasMore(page.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SearchBar value={q} onChange={setQ} busy={busy} />
      {!isSearch ? (
        <div style={{ fontSize: 12, color: ADMIN.ink500 }}>
          {filtered
            ? `Показано ${rows.length} по фильтру${showMore ? " (есть ещё)" : ""}. Поиск учитывает фильтр.`
            : `Показано ${rows.length}${showMore ? " (есть ещё)" : ""}. Начните вводить для поиска.`}
        </div>
      ) : null}
      <ClientsTable rows={rows} />
      {showMore ? (
        <div>
          <Button variant="secondary" size="sm" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Загрузка…" : "Показать ещё"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
