# 8. The Web Surfaces

Five Next.js 16 / React 19 applications, all built with Tailwind 4 and (except `aza-pay`)
a shadcn-style component layer over Base UI.

## 8.1 `aza-web` — marketing, legal and developer portal

`aza.systems` · 15,922 LOC

| Area | Route | Purpose |
|---|---|---|
| Marketing | `/`, `/about`, `/agents`, `/security`, `/mini-apps`, `/blog/[slug]` | Positioning per `PRODUCT.md`; GSAP + Lenis for motion |
| Legal | `/terms-of-service`, `/privacy-policy`, `/cookie-policy`, `/compliance` | |
| Developer portal | `/developers`, `/developers/{signup,login,forgot-password,apps,guides,changelog,status}` | Self-service app registration, docs, changelog, status |
| **API explorer** | `/developers/api-explorer` | A curated explorer built on the public OpenAPI JSON — see below |
| OAuth | `/oauth/authorize`, `/oauth/consent` | The consent screen for "Sign in with AZA" |
| Public payment page | `/pay/[handle]` | Pay any AZA user or merchant by handle without an account page |
| Public verification | `/verify` | Statement and payment-proof verification |
| Merchant public profile | `/m/[handle]` | |
| Waitlist | `/api/waitlist` | Server route → backend |

**The API explorer is an architectural decision worth a paragraph.** The backend publishes
OpenAPI JSON at `/v3/api-docs` (public), but `springdoc.paths-to-match` restricts it to
`/api/v1/merchant/**`, `/api/v1/checkout/**`, `/api/v1/developer/**` and `/oauth/**` —
internal mobile and admin endpoints are deliberately excluded from the published contract.
The raw Swagger UI, with its ungated try-it-out against the live host, is **off by default**
(`SWAGGER_UI_ENABLED=false`) and is dev-only; the public explorer wraps the same spec with
test-mode guards. The lesson: the documented API surface is a product decision, not an
artefact of the framework.

## 8.2 `aza-admin` — back office

`admin.aza.systems` · 26,654 LOC · the largest web surface, 40+ operational areas.

| Group | Areas |
|---|---|
| Customer operations | `dashboard`, `users`, `cs`, `complaints`, `disputes`, `support`, `closure-requests`, `data-requests`, `devices` |
| Compliance | `kyc`, `kyc-analytics`, `kyb-review`, `compliance`, `screening`, `risk`, `fraud-detection`, `filings`, `reports` |
| Money operations | `payouts`, `float`, `fund-transfers`, `reconciliation`, `fees`, `recurring-transfers`, `limit-requests`, `wallet`, `settlements` |
| Network | `agents`, `merchants`, `referrals`, `waitlist`, `segments`, `campaigns` |
| Platform | `miniapps`, `oauth-apps`, `webhooks`, `rate-limits`, `settings`, `maintenance`, `templates`, `staff` |
| Oversight | `approvals` (maker–checker queue), `audit-log`, `monitor`, `health`, `analytics`, `bulk-ops` |

Uses TanStack Query for data and **STOMP over SockJS** for live operational feeds (the
monitoring and alert views), plus `react-simple-maps` + `world-atlas` for geographic
distribution of activity. Everything behind `AdminStepUpFilter` (fresh 2FA) and, optionally,
`AdminIpAllowlistFilter`.

## 8.3 `aza-merchants` — merchant portal

`merchants.aza.systems` · 15,512 LOC

Self-service for businesses: `dashboard`, `transactions`, `customers`, `analytics`,
`products`, `invoices`, `payment-links`, `discount-codes`, `plans`, `subscriptions`,
`payouts`, `settlements`, `holds`, `mandates`, `bulk-transfers`, `send`, `connect`,
`api-keys`, `webhooks`, `embed`, `store-qr`, `oauth-apps`, `mini-apps` (submission),
`team`, `audit-logs`, `notification-preferences`, `disputes`, `settings`, plus
`signup`/`onboarding` with KYB and a `/m/[token]` mobile-KYB handoff.

Two things to highlight:
- **`store-qr`** generates the QR a physical shop displays. It can carry a `terminalId`, so
  a merchant can label tills, branches or cashiers — the field is free-form and AZA never
  interprets it (`Transaction.terminalId`).
- **`embed`** produces a drop-in payment widget, the lowest-effort integration tier below
  the hosted checkout.

## 8.4 `aza-pay` — hosted payment surfaces

`pay.aza.systems` · 2,014 LOC — deliberately the smallest app.

- `/c/[sessionId]` — hosted checkout. The buyer authenticates with AZA and pays from their
  wallet; the merchant never handles credentials.
- `/m/[mandateId]` — payment-mandate approval, where a payer reviews the merchant name,
  ceilings and cadence before authorising recurring charges. The GET for public mandate
  terms is unauthenticated so the page renders before login; approval requires a JWT.

Keeping this surface small and dependency-light is a security decision: it is the only web
app that routinely handles an authenticated payment action from an untrusted referrer, so
its attack surface is minimised by construction.

## 8.5 `aza-superagents` — the master-agent console

`superagents.aza.systems` · 3,145 LOC · port 3003. Built in `d35b9b59`; at the August audit
this was an empty scaffold, and the earlier draft of this chapter listed only four apps.

| Area | Route | Purpose |
|---|---|---|
| Dashboard | `/dashboard` | Downline float position at a glance |
| Agents | `/agents`, `/agents/[id]` | The master's own sub-agents and their float |
| Invite | `/agents/invite` | Files a PENDING agent application with the parent set — staff maker–checker still activates it, so a master cannot put its own recruit live |
| Distribute | `/distribute` | Push float down to a sub-agent, or recall idle float back up before a settlement run |
| Distributions | `/distributions` | The `float_distributions` ledger, filtered to this master |
| Reconciliation | `/reconciliation` | Master-level position against the sub-agent tills |

### Two security decisions worth defending

Both are places where the console deliberately does *not* copy the pattern from a sibling
app, which is the more interesting kind of decision to write up.

1. **No token reaches the browser at all.** Access and refresh are both `httpOnly` cookies,
   and every backend call goes through a single proxy route, `/api/sa/[...path]`, whose
   backend prefix is **fixed in the handler** so a crafted path cannot relay the session's
   credentials to an arbitrary endpoint. A console whose primary action is moving float is
   the wrong place for a token in `localStorage`.
2. **No 2FA bypass.** The merchant portal skips the second factor for non-staff merchants —
   a defensible trade for a self-service dashboard. This console rejects that trade, for the
   same reason as above: the actions differ, so the authentication requirement differs, even
   though the code was there to copy.

This app is also the practical test of the scaffolding checklist in §8.6: it was stood up
with security headers, CORS registration, the internal-secret proxy pattern, a port
assignment, nginx config, a compose service, a CI matrix entry and a GHCR image from the
first commit, rather than acquiring them afterwards.

## 8.6 Shared web hardening

Every app is built with a build-time `NEXT_PUBLIC_API_URL`, ships behind nginx with TLS,
and is subject to the backend's origin allow-list (`ALLOWED_ORIGINS`). New subdomain apps
are scaffolded from a checklist that applies security headers, CORS registration, the
internal-secret proxy pattern, port assignment, nginx config, compose service, CI matrix
entry and GHCR image from day one (`.claude/skills/new-subdomain-app/SKILL.md`) —
worth citing as evidence of a repeatable hardening process rather than per-app improvisation.
`aza-superagents` (§8.5) is the first app built entirely through that checklist, which makes
it the evidence that the checklist is executable rather than aspirational.
