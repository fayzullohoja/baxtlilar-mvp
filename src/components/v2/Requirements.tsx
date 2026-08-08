/**
 * Список требований к фото на экранах верификации (паспорт/селфи).
 *
 * Был скопирован байт-в-байт в v2/verify/doc/page.tsx и v2/verify/selfie/page.tsx;
 * вынесен, чтобы правка (в т.ч. по безопасности) не расходилась между копиями.
 *
 * ⛔ SEC-XSS-1. Раньше пункт рендерился через `dangerouslySetInnerHTML`, хотя это
 * обычный текст из i18n. Строки редактируются из админки (/admin/content, право
 * `i18n.edit` есть и у модератора), а write-валидация пропускала теги с
 * атрибутами ⇒ stored XSS. HTML тут не нужен: ни одна строка в messages/*.json
 * не содержит разметки. Рендерим как текст — React экранирует.
 */
export function Requirements({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--color-v2-accent)",
          marginBottom: "10px",
          fontFamily: "var(--font-v2-body)",
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--font-v2-body)",
              fontSize: "14px",
              lineHeight: "1.55",
              color: "var(--color-v2-ink-200)",
              marginBottom: "8px",
              paddingLeft: "14px",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "10px",
                width: "5px",
                height: "1px",
                background: "var(--color-v2-ink-300)",
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
