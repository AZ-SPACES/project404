import type { Metadata } from "next";
import { DevNav } from "../_ui/DevNav";
import { DevFooter } from "../_ui/DevFooter";

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
    version: "v1.7.0",
    date: "2026-07-01",
    summary: "Aza Connect — split payments to sellers at checkout and direct payouts to individual seller wallets.",
    changes: [
      { type: "added",    text: "POST /v1/merchant/sessions now accepts `splits` (list of { recipient, amount }) — each seller's share is credited straight to their Aza wallet when the buyer pays; the platform keeps the remainder after the Aza fee." },
      { type: "added",    text: "POST /v1/merchant/connect/transfers — pay an individual seller from your platform balance into their Aza wallet. Idempotent per account; simulated with an aza_test_ key." },
      { type: "added",    text: "POST /v1/merchant/connect/transfers/bulk — disburse to up to 100 sellers in one call (live keys only)." },
      { type: "added",    text: "GET /v1/merchant/connect/recipients/resolve?identifier=… — confirm a seller exists and can receive before paying them." },
      { type: "added",    text: "GET /v1/merchant/connect/balance — funds available to pay out to sellers." },
      { type: "changed",  text: "checkout.session.completed webhook now includes a `splits` array (per-seller settlement); `netAmount` is what the platform kept after the fee and splits." },
      { type: "changed",  text: "POST /v1/merchant/sessions/{id}/refund now fully refunds split payments — it claws back each credited seller's share and refunds the buyer in full, atomically (or rejects with no money moved if a seller has spent their share)." },
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-06-30",
    summary: "Mini app submissions: screenshots and live URL validation.",
    changes: [
      { type: "added",    text: "PUT /v1/dev/miniapps now accepts `screenshotUrls` (up to 6 HTTPS image URLs) — shown to reviewers during admin approval." },
      { type: "changed",  text: "Submitting a mini app for review now verifies the app URL is reachable over a valid HTTPS endpoint; unreachable or non-2xx URLs are rejected with a clear error." },
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-06-29",
    summary: "Checkout session references for platform/multi-tenant reconciliation.",
    changes: [
      { type: "added",    text: "POST /v1/merchant/sessions now accepts an optional `reference` (≤255 chars) — your own order or tenant/seller id, returned on the session." },
      { type: "added",    text: "GET /v1/merchant/sessions?reference=… — filter checkout sessions by a reference." },
      { type: "added",    text: "GET /v1/merchant/sessions/summary?reference=… — reconcile a reference: count, gross total and net total of its COMPLETED sessions." },
      { type: "changed",  text: "checkout.session.completed webhook payload now includes `reference`, `description` and `metadata` so payments can be attributed from the webhook alone." },
    ],
  },
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

const typeConfig: Record<ChangeType, { label: string; bg: string; color: string; ring: string }> = {
  added:      { label: "Added",      bg: "#eaf7e0", color: "#1e6b23", ring: "#cdeab3" },
  changed:    { label: "Changed",    bg: "#e8f0fe", color: "#1a56db", ring: "#c7dbfb" },
  deprecated: { label: "Deprecated", bg: "#fff2df", color: "#b45309", ring: "#fbdca0" },
  fixed:      { label: "Fixed",      bg: "#e7f6ec", color: "#1b7a3d", ring: "#c3e9d1" },
  removed:    { label: "Removed",    bg: "#fdeaea", color: "#c62828", ring: "#f6c9c9" },
  security:   { label: "Security",   bg: "#f5eafb", color: "#7b1fa2", ring: "#e5c9f2" },
};

function ChangeTag({ type }: { type: ChangeType }) {
  const cfg = typeConfig[type];
  return (
    <span
      className="shrink-0 inline-block rounded px-2 py-0.5 text-[0.7rem] font-bold ring-1 ring-inset"
      style={{ background: cfg.bg, color: cfg.color, ["--tw-ring-color" as string]: cfg.ring }}
    >
      {cfg.label}
    </span>
  );
}

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#111827] antialiased">
      <DevNav active="/developers/changelog" />

      <main className="flex-1">
        {/* Hero */}
        <div className="mx-auto max-w-3xl px-5 pt-14 pb-8 sm:px-6">
          <h1
            className="text-3xl font-black tracking-tight text-[#111827] sm:text-4xl"
            style={{ letterSpacing: "-0.03em", textWrap: "balance" } as React.CSSProperties}
          >
            API Changelog
          </h1>
          <p className="mt-3 max-w-md text-base text-[#6b7280]">
            Every release, documented. Breaking changes are called out explicitly.
          </p>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.entries(typeConfig) as [ChangeType, typeof typeConfig[ChangeType]][]).map(([type, cfg]) => (
              <span
                key={type}
                className="rounded px-2.5 py-1 text-[0.75rem] font-semibold ring-1 ring-inset"
                style={{ background: cfg.bg, color: cfg.color, ["--tw-ring-color" as string]: cfg.ring }}
              >
                {cfg.label}
              </span>
            ))}
          </div>
        </div>

        {/* Releases */}
        <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pb-20 sm:px-6">
          {releases.map((release, ri) => (
            <div key={release.version} className="relative flex gap-5">
              {/* Timeline spine */}
              <div className="flex flex-col items-center">
                <div
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: ri === 0 ? "#2e7d2e" : "#fff", border: ri === 0 ? "none" : "1.5px solid #cdeab3" }}
                />
                {ri < releases.length - 1 && <div className="mt-1 w-px flex-1 bg-[#e5e7eb]" />}
              </div>

              {/* Content */}
              <div className="flex-1 pb-11">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span id={release.version} className="text-[1.1rem] font-black tracking-tight text-[#111827]">
                      {release.version}
                    </span>
                    {ri === 0 && (
                      <span className="rounded bg-[#eaf7e0] px-2 py-0.5 text-[0.65rem] font-bold text-[#1e6b23] ring-1 ring-inset ring-[#cdeab3]">
                        Latest
                      </span>
                    )}
                  </div>
                  <time className="mt-1 shrink-0 text-[0.75rem] text-[#9ca3af]" dateTime={release.date}>
                    {new Date(release.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </time>
                </div>

                <p className="mb-5 text-[0.9rem] leading-relaxed text-[#374151]">{release.summary}</p>

                <ul className="flex flex-col gap-2.5">
                  {release.changes.map((change, ci) => (
                    <li key={ci} className="flex items-start gap-2.5">
                      <ChangeTag type={change.type} />
                      <span className="pt-0.5 text-[0.875rem] leading-[1.55] text-[#4b5563]">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>

      <DevFooter />
    </div>
  );
}
