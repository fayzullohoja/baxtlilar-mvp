import { NextRequest, NextResponse } from "next/server";
import { loadActiveUserApi } from "@/lib/auth/active-guard";
import { tryTransition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearSession } from "@/lib/auth/session";
import { BUCKET_PHOTOS, BUCKET_DOCUMENTS } from "@/lib/uploads/storage";

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
    // soft-delete: помечаем deleted, СТИРАЕМ все ПД и файлы, чистим сессию (строка users остаётся для аудита)
    await tryTransition(user.id, { lifecycle_state: "deleted" }, "user deleted account", {
      kind: "user",
      id: user.id,
    });
    // обезличиваем users (телефон + telegram-профиль)
    await sb
      .from("users")
      .update({
        deleted_at: new Date().toISOString(),
        phone_number: null,
        phone_verified: false,
        telegram_username: null,
        telegram_first_name: null,
        telegram_last_name: null,
      })
      .eq("id", user.id);

    // фото и документы — из стораджа (ошибки не должны срывать всё стирание — try/catch)
    try {
      const { data: photos } = await sb.from("profile_photos").select("path").eq("user_id", user.id);
      const photoPaths = (photos ?? []).map((p) => p.path as string);
      if (photoPaths.length) await sb.storage.from(BUCKET_PHOTOS).remove(photoPaths);
      const { data: docFiles } = await sb.storage.from(BUCKET_DOCUMENTS).list(user.id);
      if (docFiles?.length)
        await sb.storage.from(BUCKET_DOCUMENTS).remove(docFiles.map((f) => `${user.id}/${f.name}`));
    } catch (e) {
      console.error("[account.delete] storage cleanup failed (continuing):", e);
    }

    // ПД из всех таблиц (анкета, опрос, согласия, метаданные документов, квоты, OTP, просмотры)
    for (const tbl of [
      "profile_photos",
      "user_profiles",
      "quiz_answers",
      "quiz_results",
      "consents",
      "user_documents",
      "daily_request_quotas",
      "otp_codes",
    ] as const) {
      await sb.from(tbl).delete().eq("user_id", user.id);
    }
    await sb.from("match_views").delete().eq("viewer_id", user.id);
    // отменяем висящие интересы удаляемого: отправленные → withdrawn (получатель
    // не примет «призрака» в чат и не отправит ему уведомление), полученные →
    // declined (отправитель не ждёт ответа от удалённого). Только pending.
    await sb.from("match_requests").update({ status: "withdrawn" }).eq("sender_id", user.id).eq("status", "pending");
    await sb.from("match_requests").update({ status: "declined" }).eq("receiver_id", user.id).eq("status", "pending");

    // свободный текст пользователя (содержит ПД): сообщения, заметка интереса, текст жалобы
    await sb.from("chat_messages").update({ body: "[удалено]" }).eq("sender_id", user.id);
    await sb.from("match_requests").update({ message: null }).eq("sender_id", user.id);
    await sb.from("reports").update({ comment: null }).eq("reporter_id", user.id);

    await clearSession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
