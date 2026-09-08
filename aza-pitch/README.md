# aza-pitch

The AZA pitch deck — one app carrying three decks, chosen at an opening gate:

| Track | Slides | Argument |
|---|---|---|
| Investor | 15 | The cash network, the flywheel, unit economics, the fee catalogue |
| Partner & regulator | 11 | Closed-loop ledger, safeguarding, agent controls, dual control, audit |
| Academic | 18 | Thesis defence: objectives, invariants, concurrency, the withdrawn E2EE property |

Presented by scrolling (CSS scroll-snap, one slide per viewport) or with the arrow
keys. `Esc` returns to the gate. Every slide is deep-linkable, and a whole track is
sendable as a link: `pitch.aza.systems/?track=investor#unit-economics`.

## Local development

```bash
npm install
npm run dev       # http://localhost:3004
```

Do **not** run `npm run build` while `npm run dev` is running — both write to `.next`,
and the dev server will start serving a half-overwritten build. Stop the dev server
first. (`NEXT_DIST_DIR` does not help; Next reads `distDir` from `next.config.ts` only.)

## Where the content comes from

Every figure is drawn from a source in this repository and is dated on the slide:

- Investor track → `docs/aza-cash-network-revenue-strategy.html`
- Partner and academic tracks → `docs/thesis/`
- Headline figures re-verified against the repo at commit `9678fa5a` (2026-09-06)

Rates on the investor fee slides are *suggested* rates, and the unit-economics slide
says so on its face. There is no live transaction volume; nothing in the deck presents
an engineering measurement as a traction measurement. Keep it that way.

## Adding or reordering a slide

Two places, and they match **by position, not by id**:

1. `src/lib/deck.ts` — the track's `SlideMeta[]`. Drives the rail, the counter, the
   keyboard jumps and the deep-link ids.
2. `src/app/page.tsx` — the JSX for that track.

Edit both together or the rail will label the wrong slide.

## Theming

Light is the default; dark is opt-in via the toggle and persisted in `localStorage`
under `aza-pitch-theme`. The theme is stamped onto `<html data-theme>` by an inline
script in `layout.tsx` before first paint, so there is no flash.

Slides never reference a raw colour. Everything expressive resolves through
`--accent`, which is the deep green `#174717` on the light ground and the brand lime
`#B7EE7A` on the dark one — the lime is about 1.3:1 on the light sage and cannot carry
text. `--lime` remains available for fills that sit *behind* dark text.

## Deploying

Production is **Vercel**, like the other five Next.js apps. The droplet serves
`api.aza.systems` only, and `docker-compose.backend.yml` disables every frontend
service — so there is deliberately **no nginx vhost** for this app. The Compose
service exists only so the whole stack can still be brought up on one machine.

Already wired in this repo:

- `.github/workflows/ci.yml` — frontend matrix entry (lint + build). This is the
  load-bearing one: an app missing here is never built.
- `docker-compose.yml` — `aza-pitch` service
- `docker-compose.backend.yml` — `profiles: ["disabled"]` on the droplet

### Manual, once (needs your Vercel and Cloudflare accounts)

**1. Vercel project**

| Setting | Value |
|---|---|
| Root Directory | `aza-pitch` |
| Framework Preset | Next.js |
| Node.js Version | 22.x (matches CI) |
| Build / Install Command | defaults |
| Environment Variable | `NEXT_PUBLIC_SITE_URL` = `https://pitch.aza.systems` |

Then add `pitch.aza.systems` under the project's Domains.

`output: "standalone"` in `next.config.ts` is for the Dockerfile; Vercel ignores it.
The five sibling apps are configured the same way.

**2. Cloudflare DNS**

Add the record Vercel shows you for the domain — normally:

```
CNAME   pitch   cname.vercel-dns.com
```

Match the proxy (orange-cloud) setting used by the sibling subdomains rather than
guessing; Vercel domain verification behaves differently when proxied.

> Remember the Vercel/Cloudflare geoblock incident: any *server-side* fetch from a new
> egress needs allowlisting. This app makes no backend calls at all, so it is not
> affected — noted only so the check is not skipped for the next app that does.

## Security headers

Set in `next.config.ts`, carried over from `aza-superagents`: CSP, HSTS,
`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`.

The app has no auth, no cookies and makes no backend calls, so `connect-src 'self'` is
a policy it actually satisfies. `'unsafe-eval'` is added **in development only** —
React's dev build needs `eval()` to reconstruct stack frames, and without it the Next
overlay sits permanently in an error state. Production is unchanged.
