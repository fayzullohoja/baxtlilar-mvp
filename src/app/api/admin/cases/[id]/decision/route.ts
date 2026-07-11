import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  validatePassportPayload,
  type PassportPayload,
} from "@/lib/admin/passport-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "approve" | "needs_changes" | "reject_technical";
  payload?: Partial<PassportPayload>;
  // QZ-5: результат ручной сверки лица — пишется в case_events (аудит).
  face_match?: {
    face_selfie_matches: boolean;
    liveness_ok: boolean;
    age_matches: boolean;
  } | null;
  reason_code?: string;
  reason_text?: string;
  expected_updated_at?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { session, res } = await requireAdminApi();
  if (res) return res;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.action || !body.expected_updated_at) {
    return NextResponse.json(
      { ok: false, error: "bad_payload" },
      { status: 400 },
    );
  }

  if (body.action === "approve") {
    if (!body.payload) {
      return NextResponse.json(
        { ok: false, error: "payload_required" },
        { status: 400 },
      );
    }
    const errors = validatePassportPayload(body.payload);
    const blockers = errors.filter((e) => e.severity === "block");
    if (blockers.length > 0) {
      return NextResponse.json(
        { ok: false, error: "validation_failed", errors: blockers },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin().rpc(
      "admin_approve_verification",
      {
        p_case_id: id,
        p_admin_id: session.adminId,
        p_payload: body.payload,
        p_expected_updated_at: body.expected_updated_at,
        p_face_match: body.face_match ?? null,
      },
    );
    if (error) {
      return NextResponse.json(
        { ok: false, error: "rpc_error", detail: error.message },
        { status: 500 },
      );
    }
    const out = data as {
      ok: boolean;
      error?: string;
      current_updated_at?: string;
      identity_id?: string;
      user_id?: string;
    };
    if (!out.ok) {
      const status =
        out.error === "stale_case" || out.error === "duplicate_identity"
          ? 409
          : out.error === "case_not_found"
            ? 404
            : out.error === "not_claimed_by_you"
              ? 403
              : 400;
      return NextResponse.json(out, { status });
    }
    return NextResponse.json(out);
  }

  // reject branch: needs_changes / reject_technical
  if (
    body.action === "needs_changes" ||
    body.action === "reject_technical"
  ) {
    if (!body.reason_text || body.reason_text.length < 3) {
      return NextResponse.json(
        { ok: false, error: "reason_required" },
        { status: 400 },
      );
    }
    const outcome =
      body.action === "needs_changes" ? "needs_changes" : "rejected_technical";
    const { data, error } = await supabaseAdmin().rpc(
      "admin_reject_verification",
      {
        p_case_id: id,
        p_admin_id: session.adminId,
        p_outcome: outcome,
        p_reason_code: body.reason_code ?? "",
        p_reason_text: body.reason_text,
        p_expected_updated_at: body.expected_updated_at,
      },
    );
    if (error) {
      return NextResponse.json(
        { ok: false, error: "rpc_error", detail: error.message },
        { status: 500 },
      );
    }
    const out = data as { ok: boolean; error?: string };
    if (!out.ok) {
      const status =
        out.error === "stale_case"
          ? 409
          : out.error === "case_not_found"
            ? 404
            : out.error === "not_claimed_by_you"
              ? 403
              : 400;
      return NextResponse.json(out, { status });
    }
    return NextResponse.json(out);
  }

  return NextResponse.json(
    { ok: false, error: "bad_action" },
    { status: 400 },
  );
}
