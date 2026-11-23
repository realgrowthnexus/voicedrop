import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");
const umami = process.env.NEXT_PUBLIC_UMAMI_SRC ? new URL(process.env.NEXT_PUBLIC_UMAMI_SRC).origin : "";

// Inline scripts are needed for the theme bootstrap and Next.js hydration; everything else is allow-listed.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://*.paddle.com https://challenges.cloudflare.com ${umami}`,
  "style-src 'self' 'unsafe-inline' https://*.paddle.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  `connect-src 'self' https://*.paddle.com https://challenges.cloudflare.com ${umami} ${isDev ? "ws:" : ""}`,
  "frame-src https://*.paddle.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://buy.paddle.com\" \"https://sandbox-buy.paddle.com\")" },
  ...(!isHttps ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/samples/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
