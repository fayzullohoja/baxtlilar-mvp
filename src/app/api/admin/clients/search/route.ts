import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { searchClients } from "@/lib/admin/load-clients-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  // F-120: директория клиентов раскрывает ПИНФЛ/паспорт/телефон ЛЮБОГО клиента,
  // не только из очереди модератора — это super-only возможность (как /admin/users
  // в проде). Модератор работает через свою очередь и карточки из неё.
  if (session.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await searchClients(q, 20);
  return NextResponse.json({ ok: true, rows: result.rows });
}
