import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Changelog | Aza Developers",
  description: "A history of changes to the Aza REST API — new endpoints, breaking changes, deprecations, and fixes.",
};

type ChangeType = "added" | "changed" | "deprecated" | "fixed" | "removed" | "security";

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  summary: string;
  changes: Change[];
}

const releases: Release[] = [
  {
    version: "v1.4.0",
    date: "2026-06-10",
    summary: "Mini-app consent, device presence API, and E2EE history sync.",
    changes: [
      { type: "added",    text: "POST /v1/miniapps/{id}/consent — record user consent for a mini-app's requested scopes." },
      { type: "added",    text: "GET /v1/devices — list all devices currently linked to the authenticated user." },
      { type: "added",    text: "POST /v1/chats/sync/backup — upload an encrypted chat history blob tied to a recovery code." },
      { type: "added",    text: "POST /v1/chats/sync/restore — retrieve and decrypt an encrypted backup with a valid recovery code." },
      { type: "changed",  text: "WebSocket presence events now include deviceId so clients can distinguish per-device activity." },
      { type: "fixed",    text: "Presence lastSeenAt was not updating when a WS connection dropped without an explicit disconnect frame." },
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-06-05",
    summary: "Staff RBAC, maker-checker for high-value transfers, and AZA Agent platform.",
    changes: [
      { type: "added",    text: "GET /v1/admin/staff — list staff members and their roles (super_admin, compliance, support, viewer)." },
      { type: "added",    text: "POST /v1/admin/staff/{id}/roles — assign or revoke staff roles." },
      { type: "added",    text: "POST /v1/admin/step-up — initiate a 2FA step-up challenge for sensitive admin actions." },
      { type: "added",    text: "GET /v1/admin/transfers/pending-review — transfers held for maker-checker approval." },
      { type: "added",    text: "POST /v1/agents — register an AZA Agent (autonomous financial agent with a wallet)." },
      { type: "changed",  text: "Transfers ≥ ₵5,000 now require a maker-checker approval before execution. Returns 202 Accepted with a review_id while pending." },
      { type: "fixed",    text: "Transfer auto-rejection scheduler was not firing for transfers held exactly at the 48-hour boundary." },
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-05-28",
    summary: "Spending analytics, budget API, and AI financial insights.",
    changes: [
      { type: "added",    text: "GET /v1/analytics/spending — returns categorised spending totals for a date range." },
      { type: "added",    text: "GET /v1/budgets — list all budgets for the authenticated user." },
      { type: "added",    text: "POST /v1/budgets — create a new monthly budget for a spending category." },
      { type: "added",    text: "POST /v1/ai/insights — returns AI-generated spending insights (powered by Claude)." },
      { type: "added",    text: "POST /v1/ai/chat — multi-turn AI financial assistant. Returns streaming SSE." },
      { type: "deprecated", text: "GET /v1/transfers/summary is deprecated. Use GET /v1/analytics/spending instead. Will be removed in v2.0." },
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-05-10",
    summary: "Merchant portal, payment links, webhooks, and OAuth Sign in with AZA.",
    changes: [
      { type: "added",    text: "POST /v1/merchant/payment-links — create a shareable payment link." },
      { type: "added",    text: "GET /v1/merchant/transactions — paginated transaction history for the merchant." },
      { type: "added",    text: "POST /v1/merchant/webhooks — register a webhook endpoint." },
      { type: "added",    text: "POST /v1/oauth/token — exchange an authorization code for an access token (OAuth 2.0 PKCE)." },
      { type: "added",    text: "GET /v1/oauth/userinfo — retrieve the authenticated user's public profile." },
      { type: "security", text: "API keys now support scoped permissions (read, write, webhooks). Keys created before this release retain full access but will be migrated in v2.0." },
      { type: "fixed",    text: "Webhook delivery was retrying on 2xx responses that included a non-empty error field." },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-04-15",
    summary: "Initial public release of the Aza REST API.",
    changes: [
      { type: "added", text: "POST /v1/auth/login, POST /v1/auth/refresh, POST /v1/auth/logout." },
      { type: "added", text: "GET /v1/users/me — authenticated user profile." },
      { type: "added", text: "POST /v1/transfers — initiate a peer-to-peer transfer." },
      { type: "added", text: "GET /v1/transfers — list transfers for the authenticated user." },
      { type: "added", text: "GET /v1/transfers/{id} — retrieve a single transfer." },
      { type: "added", text: "WebSocket /ws — real-time notifications for transfers, messages, and presence." },
      { type: "added", text: "POST /v1/waitlist — join the public waitlist." },
    ],
  },
];

const typeConfig: Record<ChangeType, { label: string; bg: string; color: string }> = {
  added:      { label: "Added",      bg: "rgba(183,238,122,0.15)", color: "#2E7D32"  },
  changed:    { label: "Changed",    bg: "rgba(66,133,244,0.12)",  color: "#1A56DB"  },
  deprecated: { label: "Deprecated", bg: "rgba(255,152,0,0.12)",   color: "#E65100"  },
  fixed:      { label: "Fixed",      bg: "rgba(52,168,83,0.12)",   color: "#1B5E20"  },
  removed:    { label: "Removed",    bg: "rgba(234,67,53,0.12)",   color: "#C62828"  },
  security:   { label: "Security",   bg: "rgba(142,36,170,0.12)",  color: "#6A1B9A"  },
};

function ChangeTag({ type }: { type: ChangeType }) {
  const cfg = typeConfig[type];
  return (
    <span
      className="shrink-0 inline-block px-2 py-0.5 rounded text-[0.7rem] font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export default function ChangelogPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)" }}
    >
      {/* Back nav */}
      <div className="px-6 pt-6">
        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] rounded"
          style={{ color: "rgba(183,238,122,0.6)" }}
        >
          ← Back to Developer Hub
        </Link>
      </div>

      <main>
      {/* Hero */}
      <div className="flex flex-col items-center text-center px-6 pt-16 pb-12">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[0.75rem] font-semibold mb-6"
          style={{ background: "rgba(183,238,122,0.1)", border: "1px solid rgba(183,238,122,0.2)", color: "#B7EE7A" }}
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#B7EE7A" }} />
          API Changelog
        </div>
        <h1
          className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3"
          style={{ letterSpacing: "-0.04em", textWrap: "balance" } as React.CSSProperties}
        >
          What&rsquo;s changed in{" "}
          <span style={{ color: "#B7EE7A" }}>Aza API</span>
        </h1>
        <p className="text-base max-w-md" style={{ color: "rgba(255,255,255,0.4)" }}>
          Every release, documented. Breaking changes are called out explicitly.
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-3 justify-center flex-wrap px-6 pb-10">
        {(Object.entries(typeConfig) as [ChangeType, typeof typeConfig[ChangeType]][]).map(([type, cfg]) => (
          <span
            key={type}
            className="px-2.5 py-1 rounded text-[0.75rem] font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Releases */}
      <div className="max-w-3xl mx-auto w-full px-6 pb-24 flex flex-col gap-0">
        {releases.map((release, ri) => (
          <div key={release.version} className="relative flex gap-6">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                style={{ background: ri === 0 ? "#B7EE7A" : "rgba(183,238,122,0.3)", border: ri === 0 ? "none" : "1.5px solid rgba(183,238,122,0.3)" }}
              />
              {ri < releases.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: "rgba(183,238,122,0.12)" }} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-12">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <span
                    className="text-[1.1rem] font-black tracking-tight text-white"
                    id={release.version}
                  >
                    {release.version}
                  </span>
                  {ri === 0 && (
                    <span
                      className="ml-2 px-2 py-0.5 rounded text-[0.65rem] font-bold"
                      style={{ background: "rgba(183,238,122,0.2)", color: "#B7EE7A" }}
                    >
                      Latest
                    </span>
                  )}
                </div>
                <time
                  className="text-[0.75rem] shrink-0 mt-1"
                  dateTime={release.date}
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {new Date(release.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </time>
              </div>

              <p className="text-[0.875rem] mb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {release.summary}
              </p>

              <ul className="flex flex-col gap-2.5">
                {release.changes.map((change, ci) => (
                  <li key={ci} className="flex items-start gap-2.5">
                    <ChangeTag type={change.type} />
                    <span className="text-[0.875rem] leading-[1.55] pt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {change.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      </main>

      {/* Footer */}
      <div className="mt-auto text-center pb-8 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
        © {new Date().getFullYear()} JumpSpaces, Inc. · <Link href="/developers" className="hover:text-white/40">Developer Hub</Link>
      </div>
    </div>
  );
}
