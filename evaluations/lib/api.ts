// Where the data lives.
//
// Two deployments share this build. On Vercel the pages and the browser are on
// defense.aza.systems while the database — and therefore the API — stays on the
// droplet, so every call is cross-origin and NEXT_PUBLIC_DEFENSE_API_URL carries
// it there. On the droplet the app is its own API and the variable is unset, so
// this resolves to a same-origin relative path and nothing changes.
//
// NEXT_PUBLIC_* is inlined at build time, which is what makes one image work in
// both places: the droplet's Dockerfile builds without the variable.
export const API_BASE = process.env.NEXT_PUBLIC_DEFENSE_API_URL ?? "";

/** For fetches from the browser. Relative on the droplet, absolute on Vercel. */
export const apiUrl = (path: string) => `${API_BASE}${path}`;

/**
 * For fetches from a server component, which cannot use a relative URL — there
 * is no origin to resolve it against. On the droplet the container reaches its
 * own API on the loopback, the same address the compose healthcheck uses.
 */
export const serverApiUrl = (path: string) =>
  `${API_BASE || "http://127.0.0.1:3000"}${path}`;
