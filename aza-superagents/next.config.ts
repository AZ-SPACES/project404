import type { NextConfig } from "next";

/**
 * Header set carried over from the June 2026 audit of the sibling portals, plus HSTS.
 *
 * The CSP here is stricter than aza-merchants' because this app was built to the rule that
 * the browser never talks to the API directly: every backend call goes through a same-origin
 * proxy route, so `connect-src 'self'` is a policy the app actually satisfies rather than an
 * aspiration. `frame-ancestors 'none'` — a float-distribution console has no business being
 * framed by anything.
 */
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
              // Next's inlined bootstrap needs 'unsafe-inline'; nonces would need a middleware
              // pass, which is the documented next step if this policy is tightened further.
              "script-src 'self' 'unsafe-inline'",
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
