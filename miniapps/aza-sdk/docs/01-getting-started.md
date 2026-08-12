# Getting Started with Aza Mini Apps

Mini apps are web apps that run inside the Aza mobile app. Your users are Aza users — they're already authenticated, already have a wallet, and can pay you in seconds without leaving your app.

---

## How it works

```
Your web app (HTTPS)
       │
       │  loaded in a WebView
       ▼
  Aza Mini App Player
       │
       │  window.aza injected before your page loads
       ▼
  window.aza.getUser()    → authenticated user profile
  window.aza.getBalance() → live wallet balance
  window.aza.requestPayment() → native payment dialog
```

Aza injects `window.aza` into your WebView before your first script runs. You never ship a runtime — the `@az-spaces/aza-miniapp-sdk` package is types + helpers only.

---

## Prerequisites

- An **Aza account** (you submit your app from inside the Aza app)
- Node.js 18+

That's it. No Apple or Google developer account, no domain and no server — Aza can host your
build for you. See [Hosting](#hosting-let-aza-host-it-or-host-it-yourself) below.

---

## Quickstart: scaffold a mini app

We recommend **Vite + React**. Any framework works — or none at all.

```bash
npm create vite@latest my-mini-app -- --template react-ts
cd my-mini-app
npm install
npm install @az-spaces/aza-miniapp-sdk
```

Replace `src/App.tsx` with:

```tsx
import { useAza } from '@az-spaces/aza-miniapp-sdk';

export default function App() {
  const { status, aza } = useAza();

  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'unavailable') return <p>Please open this in Aza.</p>;

  return <PayScreen aza={aza} />;
}
```

---

## Hosting: let Aza host it, or host it yourself

You do **not** need a domain, a server, or an Apple/Google developer account. Mini apps are
served in Aza's WebView and never go through either app store.

**Option A — Aza hosts it (recommended).** Upload your build output and Aza serves it:

```bash
npm run build          # or: npx expo export --platform web
cd dist && zip -r ../bundle.zip .    # zip the CONTENTS, not the folder
```

Upload `bundle.zip` in the developer portal. Your app is served at its own origin:

```
https://<your-app-id>.miniapps.aza.systems/
```

Each app gets a separate subdomain rather than a path on a shared host, so no other mini app
can read your `localStorage`, cookies or service workers — and yours cannot read theirs.

**Option B — host it yourself.** Deploy anywhere with valid TLS and submit the URL:

| Provider | Free tier | Notes |
|----------|-----------|-------|
| [Vercel](https://vercel.com) | Yes | Best for Next.js / React |
| [Netlify](https://netlify.com) | Yes | Great for static Vite builds |
| [Cloudflare Pages](https://pages.cloudflare.com) | Yes | Fast global CDN |
| Your own server | — | Must have a valid TLS cert |

Choose this if you already have infrastructure, want your own domain, or need server-side
rendering. Aza hosting is static only.

---

## Submit your app

Open Aza → Hub → Developer → **Mini Apps tab** → **New App**.

Fill in:
- **App ID** — a lowercase slug, e.g. `my_store`. Permanent, cannot be changed. It also
  becomes your subdomain if Aza hosts the app (underscores become hyphens).
- **Name** — shown to users in the hub
- **Description** — what your app does (max 500 chars)
- **Hosting** — upload a bundle, or supply your own HTTPS URL
- **Permissions** — only tick what you actually need (see [Permissions](./03-permissions.md))
- **Category** — how your app is surfaced in the hub

Submit for review. The Aza team reviews within 2–5 business days.

### Shipping updates to a live app

Uploading a new bundle never disturbs the running version. The upload is staged at
`https://<your-app-id>-preview.miniapps.aza.systems/` for review while your users stay on the
approved build, and only goes live once a reviewer approves it. Publishing and rolling back
are both instant — Aza keeps your recent versions on disk.

---

## App lifecycle

```
DRAFT  →  PENDING_REVIEW  →  ACTIVE
                          ↘  REJECTED  →  (fix & resubmit)  →  PENDING_REVIEW
ACTIVE  →  SUSPENDED (by Aza admin)
```

- **DRAFT**: saved but not submitted. You can edit freely.
- **PENDING_REVIEW**: locked for editing until reviewed.
- **ACTIVE**: live in the hub. All Aza users can find and launch it.
- **REJECTED**: the rejection reason is shown in the Developer dashboard. Fix the issue and resubmit.
- **SUSPENDED**: temporarily removed by Aza. Contact support.

---

## Next steps

- [SDK Reference](./02-sdk-reference.md) — full API docs
- [Payments](./04-payments.md) — accept payments from users
- [Permissions](./03-permissions.md) — what you can request and why
- [Local Development](./05-local-development.md) — develop without deploying
- [Submission Guide](./06-submission-guide.md) — review criteria and checklist
