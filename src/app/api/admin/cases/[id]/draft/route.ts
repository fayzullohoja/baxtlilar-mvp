import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  validatePassportPayload,
  type PassportPayload,
} from "@/lib/admin/passport-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    payload?: Partial<PassportPayload>;
  };
  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "bad_payload" },
      { status: 400 },
    );
  }

  // Сохраняем draft даже с ошибками валидации (юзер может вернуться).
  // Ошибки отдаём для UI-feedback.
  const errors = validatePassportPayload(body.payload);

  const { data, error } = await supabaseAdmin().rpc("admin_save_passport_draft", {
    p_case_id: id,
    p_admin_id: session.adminId,
    p_payload: body.payload,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "rpc_error", detail: error.message },
      { status: 500 },
    );
  }
  const out = data as {
    ok: boolean;
    error?: string;
    updated_at?: string;
  };
  if (!out.ok) {
    const status =
      out.error === "case_not_found"
        ? 404
        : out.error === "not_claimed_by_you"
          ? 403
          : 400;
    return NextResponse.json(out, { status });
  }

  return NextResponse.json({
    ok: true,
    updated_at: out.updated_at,
    errors,
  });
}
