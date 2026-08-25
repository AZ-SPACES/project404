import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  BACKEND_URL,
  accessCookieOptions,
  refreshCookieOptions,
  clearedCookieOptions,
} from "./auth-cookie";

/** Envelope every AZA endpoint answers with. */
export type ApiEnvelope<T> = { success?: boolean; data?: T; message?: string };

export type BackendCall = {
  status: number;
  body: unknown;
  /** Set when the call refreshed the session mid-flight, so the caller can re-stamp cookies. */
  rotated?: { accessToken: string; refreshToken?: string };
};

async function parse(res: Response): Promise<unknown> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return res.json().catch(() => null);
  return res.text().catch(() => null);
}

/** One unauthenticated call to the backend. */
export async function callPublic(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Aza-Client": "superagent-portal",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  return { status: res.status, body: await parse(res) };
}

/**
 * Calls the backend as the signed-in user, transparently re-minting the access token from the
 * refresh cookie on a 401 and retrying once.
 *
 * The refresh token is read here and never leaves the server. A caller that gets a `rotated`
 * back must write the new cookies onto its own response — {@link applyRotation} does that.
 */
export async function callAsUser(
  request: NextRequest,
  path: string,
  init: RequestInit = {}
): Promise<BackendCall> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return { status: 401, body: { message: "No session" } };
  }

  const send = (token: string | undefined) =>
    fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Aza-Client": "superagent-portal",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

  let res = accessToken ? await send(accessToken) : undefined;

  if (!res || res.status === 401) {
    if (!refreshToken) {
      return { status: 401, body: { message: "Session expired" } };
    }
    const refreshed = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    const refreshBody = (await parse(refreshed)) as ApiEnvelope<{
      accessToken?: string;
      refreshToken?: string;
    }> | null;
    const minted = refreshBody?.data?.accessToken;
    if (!refreshed.ok || !minted) {
      return { status: 401, body: { message: "Session expired" } };
    }
    res = await send(minted);
    return {
      status: res.status,
      body: await parse(res),
      rotated: { accessToken: minted, refreshToken: refreshBody?.data?.refreshToken },
    };
  }

  return { status: res.status, body: await parse(res) };
}

/** Writes a mid-flight token rotation onto the outgoing response. */
export function applyRotation(res: NextResponse, call: BackendCall): NextResponse {
  if (call.rotated) {
    res.cookies.set(ACCESS_COOKIE, call.rotated.accessToken, accessCookieOptions());
    if (call.rotated.refreshToken) {
      res.cookies.set(REFRESH_COOKIE, call.rotated.refreshToken, refreshCookieOptions());
    }
  }
  if (call.status === 401) {
    res.cookies.set(ACCESS_COOKIE, "", clearedCookieOptions());
    res.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
  }
  return res;
}

/** Stamps a freshly issued token pair onto a response. */
export function setSession(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
): NextResponse {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  return res;
}
