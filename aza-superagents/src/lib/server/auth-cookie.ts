/**
 * Server-only helpers for the superagent refresh-token cookie.
 *
 * The refresh token is stored as an httpOnly cookie (never readable by client JS).
 * The short-lived access token lives only in browser memory and is re-minted from
 * this cookie via /api/auth/refresh. No token is ever persisted in localStorage.
 */

export const REFRESH_COOKIE = "aza_superagent_refresh";

export const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  };
}

export function clearedCookieOptions(): CookieOptions {
  return { ...refreshCookieOptions(), maxAge: 0 };
}
