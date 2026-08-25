import { NextRequest, NextResponse } from "next/server";
import { PREAUTH_COOKIE, clearedCookieOptions } from "@/lib/server/auth-cookie";
import { ApiEnvelope, callPublic, setSession } from "@/lib/server/backend";

/**
 * Second factor. POST with `{ method }` to dispatch an EMAIL/SMS code, or `{ code, method }`
 * to complete the login. TOTP has no dispatch step, so it arrives straight here with a code.
 *
 * The pre-auth token comes from the httpOnly cookie set at the login step, never from the
 * request body — the page has no way to present a factor it was not handed.
 */
export async function POST(request: NextRequest) {
  const preAuthToken = request.cookies.get(PREAUTH_COOKIE)?.value;
  if (!preAuthToken) {
    return NextResponse.json({ message: "Start again — that sign-in step expired" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const method = typeof body?.method === "string" ? body.method : null;
  const code = typeof body?.code === "string" ? body.code : null;

  // Dispatch step: send the code to the account's email or phone.
  if (!code) {
    if (method !== "EMAIL" && method !== "SMS") {
      return NextResponse.json({ message: "Pick email or SMS" }, { status: 400 });
    }
    const path = method === "SMS" ? "/api/v1/auth/2fa/sms/request" : "/api/v1/auth/2fa/email/request";
    const { status, body: raw } = await callPublic(
      `${path}?preAuthToken=${encodeURIComponent(preAuthToken)}`,
      { method: "POST" }
    );
    if (status >= 400) {
      const envelope = raw as ApiEnvelope<unknown> | null;
      return NextResponse.json({ message: envelope?.message ?? "Could not send the code" }, { status });
    }
    return NextResponse.json({ status: "sent" });
  }

  // Verify step. TOTP goes to the authenticator endpoint; EMAIL/SMS to the OTP one.
  const verify =
    method === "EMAIL" || method === "SMS"
      ? callPublic(
          `/api/v1/auth/2fa/otp/verify?${new URLSearchParams({ preAuthToken, code, method })}`,
          { method: "POST" }
        )
      : callPublic("/api/v1/auth/2fa/login", {
          method: "POST",
          body: JSON.stringify({ preAuthToken, code }),
        });

  const { status, body: raw } = await verify;
  if (status >= 400) {
    const envelope = raw as ApiEnvelope<unknown> | null;
    return NextResponse.json({ message: envelope?.message ?? "That code didn't work" }, { status });
  }

  const obj = ((raw as ApiEnvelope<unknown> | null)?.data ?? {}) as Record<string, unknown>;
  if (typeof obj.accessToken !== "string" || typeof obj.refreshToken !== "string") {
    return NextResponse.json({ message: "That code didn't work" }, { status: 401 });
  }

  const res = setSession(NextResponse.json({ status: "authenticated" }), {
    accessToken: obj.accessToken,
    refreshToken: obj.refreshToken,
  });
  res.cookies.set(PREAUTH_COOKIE, "", clearedCookieOptions());
  return res;
}
