import type { NextConfig } from "next";

/**
 * Header set carried over from aza-superagents (the June 2026 audit set, plus HSTS).
 *
 * This app is a static presentation: it has no auth, no cookies and makes no backend
 * calls at all, so `connect-src 'self'` is not an aspiration here — there is nothing
 * for it to relax for. Fonts are self-hosted by `next/font`, which is why `font-src`
 * needs no Google origin and `style-src` needs no external stylesheet host.
 *
 * `frame-ancestors 'none'` stays: a deck that can be framed can be re-captioned by
 * whoever frames it.
 */
/**
 * React's development build calls eval() to reconstruct stack frames across the
 * server/client boundary. Under the production CSP that is blocked, which turns the
 * dev overlay into a permanent error badge and costs the useful part of the overlay.
 * So `unsafe-eval` is added in development only — the production policy is unchanged.
 */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next's inlined bootstrap needs 'unsafe-inline'; nonces would need a
              // middleware pass, which is the documented next step if this is tightened.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
