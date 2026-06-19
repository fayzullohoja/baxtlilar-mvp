import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearSession } from "@/lib/auth/session";
import { BUCKET_PHOTOS, BUCKET_DOCUMENTS } from "@/lib/uploads/storage";
import { hashPhone } from "@/lib/identity/hashing";

// F-006: окно cooldown после delete, в течение которого тот же телефон
// нельзя привязать к новому аккаунту. 90 дней закрывает повторное
// представление с теми же доками и обнуление жалоб/блоков жертвы.
const PHONE_COOLDOWN_DAYS = 90;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { user, res } = await loadActiveUserApi({ allowPaused: true });
  if (res) return res;
  const { action } = (await req.json().catch(() => ({}))) as { action?: "pause" | "resume" | "delete" };
  const sb = supabaseAdmin();

  if (action === "pause") {
    if (user.lifecycle_state !== "active")
      return NextResponse.json({ ok: false, error: "not_active" }, { status: 409 });
    const tr = await tryTransition(user.id, { lifecycle_state: "paused" }, "user paused", {
      kind: "user",
      id: user.id,
    });
    return tr.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  if (action === "resume") {
    if (user.lifecycle_state !== "paused")
      return NextResponse.json({ ok: false, error: "not_paused" }, { status: 409 });
    const tr = await tryTransition(user.id, { lifecycle_state: "active" }, "user resumed", {
      kind: "user",
      id: user.id,
    });
    return tr.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: tr.error }, { status: 409 });
  }

  if (action === "delete") {
    // F-006: до обнуления phone_number фиксируем хеш в blacklist на 90д.
    if (user.phone_number) {
      const until = new Date(Date.now() + PHONE_COOLDOWN_DAYS * 24 * 3600 * 1000).toISOString();
      const { error: bErr } = await sb.from("phone_blacklist").insert({
        phone_hash: hashPhone(user.phone_number),
        until_at: until,
        reason: "account_deleted",
      });
      if (bErr) console.error("[account.delete] phone_blacklist insert failed:", bErr.message);
    }

    // Storage paths собираем ДО erase_user — иначе строки profile_photos уже
    // удалены и пути не вытащим.
    const { data: photos } = await sb.from("profile_photos").select("path").eq("user_id", user.id);
    const photoPaths = (photos ?? []).map((p) => p.path as string);

    // F-114/F-012: единая транзакция через erase_user RPC. Раньше десяток
    // мутаций без .error-чека — частичный сбой возвращал {ok:true}, оставляя
    // ПД в БД (нарушение права на стирание ст. 28 закона РУз).
    const tr = await tryTransition(user.id, { lifecycle_state: "deleted" }, "user deleted account", {
      kind: "user",
      id: user.id,
    });
    if (!tr.ok) return NextResponse.json({ ok: false, error: tr.error }, { status: 409 });

    const { error: rpcErr } = await sb.rpc("erase_user", { p_user_id: user.id });
    if (rpcErr) {
      console.error("[account.delete] erase_user RPC failed:", rpcErr.message);
      return NextResponse.json({ ok: false, error: "erase_failed" }, { status: 500 });
    }

    // Storage — best-effort после транзакционной части (storage не
    // транзакционен; orphan-файлы лучше периодически чистить отдельным cron).
    try {
      if (photoPaths.length) await sb.storage.from(BUCKET_PHOTOS).remove(photoPaths);
      const { data: docFiles } = await sb.storage.from(BUCKET_DOCUMENTS).list(user.id);
      if (docFiles?.length)
        await sb.storage.from(BUCKET_DOCUMENTS).remove(docFiles.map((f) => `${user.id}/${f.name}`));
    } catch (e) {
      console.error("[account.delete] storage cleanup failed (continuing):", e);
    }

    await clearSession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
