import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unwrapOne } from "@/lib/db/unwrap";
import { AdminShell } from "@/components/admin/shell";
import { RevealDoc } from "@/components/admin/reveal-doc";
import { DecisionForm } from "@/components/admin/decision-form";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800">{v}</span>
    </div>
  );
}

export default async function VerificationCard({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  // unwrapOne отделяет «реально нет такого пользователя» (null → notFound) от
  // «БД упала» (throw → видимая ошибка). Без него сбой БД давал бы ложный 404.
  const user = unwrapOne(
    await supabaseAdmin()
      .from("users")
      .select(
        "id, telegram_id, telegram_username, telegram_first_name, telegram_last_name, phone_number, phone_verified, verification_status, onboarding_step, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!user) notFound();

  const name =
    [user.telegram_first_name, user.telegram_last_name].filter(Boolean).join(" ") ||
    (user.telegram_username ? "@" + user.telegram_username : (user.id as string).slice(0, 8));
  const pending = user.verification_status === "pending_review";

  return (
    <AdminShell active="/admin/verifications" role={session.role}>
      <Link href="/admin/verifications" className="text-sm text-slate-500 hover:underline">
        ← К очереди
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-2 mb-1">{name}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Статус: {pending ? "на проверке" : (user.verification_status as string)}
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-medium text-slate-800 mb-2">Данные пользователя</div>
          <Row k="Telegram" v={user.telegram_username ? "@" + user.telegram_username : "—"} />
          <Row k="Телефон" v={(user.phone_number as string) ?? "—"} />
          <Row k="Телефон подтверждён" v={user.phone_verified ? "да" : "нет"} />
          <Row k="Регистрация" v={new Date(user.created_at as string).toLocaleString("ru-RU")} />
        </div>
        <div className="space-y-4">
          <RevealDoc userId={id} kind="passport" label="Паспорт / ID" />
          <RevealDoc userId={id} kind="selfie" label="Селфи" />
        </div>
      </div>

      <div className="mt-6 max-w-xl">
        {pending ? (
          <DecisionForm userId={id} />
        ) : (
          <p className="text-slate-400 text-sm">Заявка уже обработана ({user.verification_status as string}).</p>
        )}
      </div>
    </AdminShell>
  );
}
