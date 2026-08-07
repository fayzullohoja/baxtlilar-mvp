import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, adminAudit } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { searchClients } from "@/lib/admin/load-clients-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  // F-120: директория клиентов раскрывает ПИНФЛ/паспорт/телефон ЛЮБОГО клиента,
  // не только из очереди модератора — это super-only возможность (как /admin/users
  // в проде). Модератор работает через свою очередь и карточки из неё.
  if (!can(session.role, "clients.directory")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);
  // Фильтры протягиваются с UI, чтобы поиск компоновался с активным фильтром
  // директории (раньше type-ahead молча их сбрасывал).
  const filters = {
    status: sp.get("status") ?? undefined,
    gender: sp.get("gender") ?? undefined,
    verification: sp.get("verification") ?? undefined,
  };
  const result = await searchClients(q, 30, filters, offset);
  // Инвариант 7: массовое чтение PII-директории оставляет forensic-след — как
  // просмотр карточки кейса (case_view). Пишем запрос и объём, не сами данные.
  await adminAudit({
    adminId: session.adminId,
    action: "clients_directory_search",
    entity: "clients_directory",
    newValue: { q_len: q.length, offset, filters, returned: result.rows.length },
  });
  return NextResponse.json({
    ok: true,
    rows: result.rows,
    hasMore: result.hasMore,
  });
}
