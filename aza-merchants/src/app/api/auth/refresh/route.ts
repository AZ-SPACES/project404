import { NextRequest, NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  BACKEND_URL,
  refreshCookieOptions,
  clearedCookieOptions,
} from "@/lib/server/auth-cookie";

/**
 * Re-mints a short-lived access token from the httpOnly refresh cookie and rotates
 * the refresh token. The refresh token is read server-side and never exposed to JS;
 * only the new access token is returned.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }

  const body = await upstream.json().catch(() => null);
  if (!upstream.ok || !body?.success || !body?.data?.accessToken) {
    const res = NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    res.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
    return res;
  }

  const res = NextResponse.json({ accessToken: body.data.accessToken });
  if (typeof body.data.refreshToken === "string") {
    res.cookies.set(REFRESH_COOKIE, body.data.refreshToken, refreshCookieOptions());
  }
  return res;
}
