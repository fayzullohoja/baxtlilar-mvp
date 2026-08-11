/**
 * V2 InviteNotVerifiedCard (Task 9, раунд исправлений 1).
 *
 * Чисто презентационная карточка «код появится после проверки» - без хуков,
 * без "use client". Поэтому рендерится и в серверном page.tsx (для основного
 * случая - юзер ещё не approved, статус уже известен из requireActiveUser,
 * поход на GET /api/invite не нужен вовсе), и в клиентском InviteScreen.tsx
 * (защитная ветка на случай гонки: статус изменился между рендером страницы
 * и fetch). Один компонент - один текст, а не два места, которые могут
 * разъехаться.
 *
 * Бирюзовый акцент вместо красного danger - подчёркивает, что это не сбой,
 * а нормальный этап (см. VerificationPlashka - тот же приём).
 */
export function InviteNotVerifiedCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="v2-rise"
      style={{
        background: "#fff",
        border: "1px solid var(--color-v2-border)",
        borderRadius: "var(--v2-radius-card)",
        boxShadow: "var(--v2-shadow-card)",
        padding: "28px 22px",
        fontFamily: "var(--font-v2-body)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-teal)",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: "15px",
          lineHeight: "1.55",
          color: "var(--color-v2-ink-200)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}
