import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  PREAUTH_COOKIE,
  REFRESH_COOKIE,
  clearedCookieOptions,
} from "@/lib/server/auth-cookie";
import { callAsUser } from "@/lib/server/backend";

/** Revokes the session server-side, then drops every cookie this app set. */
export async function POST(request: NextRequest) {
  // Best-effort: the cookies come off regardless of what the backend says.
  await callAsUser(request, "/api/v1/auth/logout", { method: "POST" }).catch(() => null);

  const res = NextResponse.json({ ok: true });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, PREAUTH_COOKIE]) {
    res.cookies.set(name, "", clearedCookieOptions());
  }
  return res;
}
