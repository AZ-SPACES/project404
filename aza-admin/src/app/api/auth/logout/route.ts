import { NextResponse } from "next/server";
import { REFRESH_COOKIE, clearedCookieOptions } from "@/lib/server/auth-cookie";

/** Clears the httpOnly refresh cookie. The client also drops its in-memory access token. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
  return res;
}
