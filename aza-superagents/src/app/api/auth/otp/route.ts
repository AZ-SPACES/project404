import { NextRequest, NextResponse } from "next/server";
import { PREAUTH_COOKIE, preauthCookieOptions } from "@/lib/server/auth-cookie";
import { ApiEnvelope, callPublic, setSession } from "@/lib/server/backend";

/**
 * Verifies the emailed/SMS login code. An account that also has 2FA enabled gets a pre-auth
 * token here instead of tokens — the second factor still has to be cleared — so this can hand
 * back either outcome.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier : null;
  const code = typeof body?.code === "string" ? body.code : null;
  if (!identifier || !code) {
    return NextResponse.json({ message: "Enter the code we sent you" }, { status: 400 });
  }

  const { status, body: raw } = await callPublic("/api/v1/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ identifier, code, purpose: "login" }),
  });

  if (status >= 400) {
    const envelope = raw as ApiEnvelope<unknown> | null;
    return NextResponse.json({ message: envelope?.message ?? "That code didn't work" }, { status });
  }

  const obj = ((raw as ApiEnvelope<unknown> | null)?.data ?? {}) as Record<string, unknown>;

  if (typeof obj.preAuthToken === "string") {
    const res = NextResponse.json({
      status: "two_factor_required",
      methods: Array.isArray(obj.methods) ? obj.methods : [],
      defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
    });
    res.cookies.set(PREAUTH_COOKIE, obj.preAuthToken, preauthCookieOptions());
    return res;
  }

  if (typeof obj.accessToken === "string" && typeof obj.refreshToken === "string") {
    return setSession(NextResponse.json({ status: "authenticated" }), {
      accessToken: obj.accessToken,
      refreshToken: obj.refreshToken,
    });
  }

  return NextResponse.json({ message: "That code didn't work" }, { status: 401 });
}
