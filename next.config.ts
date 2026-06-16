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

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next-гидрация = inline-скрипты; telegram-web-app.js грузится с telegram.org
      "script-src 'self' 'unsafe-inline' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:", // signed URL фото/документов (same-origin /api/storage) + аватары TG
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
