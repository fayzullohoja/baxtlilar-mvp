import type { NextConfig } from "next";

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
  // CSP с allowlist для Telegram (frame-ancestors); base-uri и form-action — для безопасности
  {
    key: "Content-Security-Policy",
    value: [
      `frame-ancestors ${TG_FRAME_ANCESTORS.join(" ")}`,
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
