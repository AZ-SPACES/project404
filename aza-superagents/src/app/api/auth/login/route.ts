import { NextRequest, NextResponse } from "next/server";
import { PREAUTH_COOKIE, preauthCookieOptions } from "@/lib/server/auth-cookie";
import { ApiEnvelope, callPublic, setSession } from "@/lib/server/backend";

/**
 * Starts a password login.
 *
 * A super agent is an ordinary AZA user, so this deliberately sends no portal bypass header:
 * the merchant portal skips the second factor for non-staff merchants, and a console that moves
 * float down a network is the last place to copy that shortcut. Whatever factors the account
 * has enabled are the factors it has to clear.
 *
 * /api/v1/auth/login answers in one of three shapes, so the client is told which step is next
 * rather than having to sniff it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier : null;
  const password = typeof body?.password === "string" ? body.password : null;
  if (!identifier || !password) {
    return NextResponse.json({ message: "Enter your email or phone and your password" }, { status: 400 });
  }

  const { status, body: raw } = await callPublic("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password, deviceName: "Super agent portal", deviceOs: "web" }),
  });

  if (status >= 400) {
    const envelope = raw as ApiEnvelope<unknown> | null;
    return NextResponse.json(
      { message: envelope?.message ?? "Invalid credentials" },
      { status: status === 401 ? 401 : status }
    );
  }

  const data = (raw as ApiEnvelope<unknown> | null)?.data;

  // Accounts that get an emailed/SMS login OTP: the backend answers with a plain string.
  if (typeof data === "string") {
    return NextResponse.json({ status: "otp_required" });
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (typeof obj.accessToken === "string" && typeof obj.refreshToken === "string") {
      return setSession(NextResponse.json({ status: "authenticated" }), {
        accessToken: obj.accessToken,
        refreshToken: obj.refreshToken,
      });
    }

    if (typeof obj.preAuthToken === "string") {
      // The pre-auth token is a bearer credential for five minutes, so it is stashed in an
      // httpOnly cookie and never handed to the page — only the choice of factor is.
      const res = NextResponse.json({
        status: "two_factor_required",
        methods: Array.isArray(obj.methods) ? obj.methods : [],
        defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
      });
      res.cookies.set(PREAUTH_COOKIE, obj.preAuthToken, preauthCookieOptions());
      return res;
    }
  }

  // Unrecognised shape: ask for a code rather than failing open into a half-signed-in state.
  return NextResponse.json({ status: "otp_required" });
}
