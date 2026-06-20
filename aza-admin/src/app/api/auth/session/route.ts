import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE, refreshCookieOptions } from "@/lib/server/auth-cookie";

/**
 * Stores a freshly issued refresh token as an httpOnly cookie. Called by the client
 * once, immediately after login, so the refresh token leaves JS memory and lives only
 * in a cookie the browser can never read.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string") {
    return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return res;
}
