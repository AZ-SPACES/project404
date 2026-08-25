/**
 * Server-only session cookies for the super-agent portal.
 *
 * This app holds NO token in the browser at all — not even in memory. The access and refresh
 * tokens are both httpOnly cookies read only by the route handlers in `src/app/api`, and every
 * backend call is forwarded by the same-origin proxy. That is a step past the sibling portals,
 * where the access token lives in a JS variable: here an XSS has nothing to read, because the
 * page never sees a credential.
 *
 * `preauth` holds the short-lived 2FA handoff token for the same reason — it is a bearer
 * credential for five minutes, so it does not belong in JS either.
 */

export const ACCESS_COOKIE = "aza_sa_access";
export const REFRESH_COOKIE = "aza_sa_refresh";
export const PREAUTH_COOKIE = "aza_sa_preauth";

export const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
/** Comfortably longer than the access token's own lifetime; the backend is the real authority. */
const ONE_HOUR_SECONDS = 60 * 60;
const FIVE_MINUTES_SECONDS = 5 * 60;

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

function base(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export const accessCookieOptions = () => base(ONE_HOUR_SECONDS);
export const refreshCookieOptions = () => base(THIRTY_DAYS_SECONDS);
export const preauthCookieOptions = () => base(FIVE_MINUTES_SECONDS);
export const clearedCookieOptions = () => base(0);
