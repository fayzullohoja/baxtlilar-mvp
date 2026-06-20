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
  const { action } = (await req.json().catch(() => ({}))) as {
    action?: "pause" | "resume" | "delete" | "export";
  };
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
    // C6 verdict-fix: blocking-rejected юзер НЕ может удалить аккаунт. Иначе
    // erase_user сносит user_documents.sha → R3 защита теряется (sha_blacklist
    // в admin_blocking_reject частично закрывает, но это последняя линия —
    // удаление аккаунта = молчаливый bypass для модератора). Юзер должен
    // обратиться в поддержку для unblock-flow.
    const { data: docCheck } = await sb
      .from("user_documents")
      .select("reject_category")
      .eq("user_id", user.id)
      .maybeSingle();
    if (docCheck?.reject_category === "blocking") {
      return NextResponse.json(
        { ok: false, error: "tombstone_pending", message: "contact_support" },
        { status: 409 },
      );
    }

    // F-006: до обнуления phone_number фиксируем хеш в blacklist на 90д.
    if (user.phone_number) {
      const until = new Date(Date.now() + PHONE_COOLDOWN_DAYS * 24 * 3600 * 1000).toISOString();
      const { error: bErr } = await sb.from("phone_blacklist").insert({
        phone_hash: hashPhone(user.phone_number),
        until_at: until,
        reason: "account_deleted",
        linked_user_id: user.id, // F-final-2 (C10): reverse-link для /unblock
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

  if (action === "export") {
    // F-118: право субъекта получить копию своих ПД (ст. 25 закона РУз "О ПД").
    // Rate-limit 1/24h — иначе можно DoS'нуть сервер большими JSON-блобами.
    // Возвращаем только данные, авторство которых принадлежит пользователю
    // (его сообщения, заявки, жалобы); содержимое других сторон НЕ дублируем.
    const EXPORT_COOLDOWN_MS = 24 * 3600 * 1000;
    const { data: meta } = await sb
      .from("users")
      .select("exported_at")
      .eq("id", user.id)
      .maybeSingle();
    if (meta?.exported_at && Date.now() - new Date(meta.exported_at as string).getTime() < EXPORT_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const [profile, photos, qAnswers, qResults, consents, docs, sentReqs, recvReqs, myMsgs, myReports, stateLog] =
      await Promise.all([
        sb.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        sb.from("profile_photos").select("id, ord, is_main, status, created_at").eq("user_id", user.id),
        sb.from("quiz_answers").select("*").eq("user_id", user.id),
        sb.from("quiz_results").select("*").eq("user_id", user.id),
        sb
          .from("consents")
          .select("consent_type, consent_version, accepted_at, language, ip, user_agent")
          .eq("user_id", user.id),
        sb
          .from("user_documents")
          .select("status, passport_path, selfie_path, created_at, moderated_at, reject_reason")
          .eq("user_id", user.id)
          .maybeSingle(),
        sb
          .from("match_requests")
          .select("id, receiver_id, status, message, created_at, auto_decline_at")
          .eq("sender_id", user.id),
        sb
          .from("match_requests")
          .select("id, sender_id, status, message, created_at, auto_decline_at")
          .eq("receiver_id", user.id),
        sb
          .from("chat_messages")
          .select("id, chat_id, body, created_at, read_at")
          .eq("sender_id", user.id),
        sb
          .from("reports")
          .select("id, target_user_id, reason, comment, status, created_at")
          .eq("reporter_id", user.id),
        sb
          .from("user_state_transitions")
          .select("from_state, to_state, reason, triggered_by_kind, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

    await sb.from("users").update({ exported_at: new Date().toISOString() }).eq("id", user.id);

    return NextResponse.json({
      ok: true,
      exported_at: new Date().toISOString(),
      schema_version: 1,
      data: {
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          telegram_username: user.telegram_username,
          telegram_first_name: user.telegram_first_name,
          phone_number: user.phone_number,
          phone_verified: user.phone_verified,
          language: user.language,
          lifecycle_state: user.lifecycle_state,
          onboarding_step: user.onboarding_step,
          verification_status: user.verification_status,
        },
        profile: profile.data ?? null,
        photos: photos.data ?? [],
        quiz_answers: qAnswers.data ?? [],
        quiz_results: qResults.data ?? [],
        consents: consents.data ?? [],
        documents: docs.data ?? null,
        sent_requests: sentReqs.data ?? [],
        received_requests: recvReqs.data ?? [],
        my_messages: myMsgs.data ?? [],
        my_reports: myReports.data ?? [],
        state_transitions: stateLog.data ?? [],
      },
    });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
