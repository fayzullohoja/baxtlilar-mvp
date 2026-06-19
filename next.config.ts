import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Telegram-домены для frame-ancestors (Mini App грузится как iframe в TG-клиентах).
const TG_FRAME_ANCESTORS = [
  "'self'",
  "https://web.telegram.org",
  "https://*.telegram.org",
  "https://t.me",
];

// F-116 (CSP nonce) НЕ применён — требует middleware-нонс через next-intl
// composition + ручной браузерный тест в TG WebView. Делаю когда будет
// возможность прокликать. Пока — статический CSP с 'unsafe-inline'.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      `frame-ancestors ${TG_FRAME_ANCESTORS.join(" ")}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
