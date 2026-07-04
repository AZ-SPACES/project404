import { NextRequest, NextResponse } from "next/server";

// Standard OAuth 2.0 authorization endpoint (RFC 6749 §3.1).
//
// Off-the-shelf OAuth clients kick off the flow by pointing the browser at
//   GET /oauth/authorize?response_type=code&client_id=…&redirect_uri=…&scope=…&state=…
// AZA's native flow is different: the partner's *server* POSTs to
// api.aza.systems/oauth/authorize and gets back a consent URL to redirect to.
// This adapter accepts the standard browser GET, runs it through that native
// flow server-side, and 302s the user to the consent page — so any conventional
// OAuth/plugin client works without a custom integration.
const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.aza.systems";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const responseType = p.get("response_type");
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const scope = p.get("scope");
  const state = p.get("state");
  const codeChallenge = p.get("code_challenge") ?? undefined;
  const codeChallengeMethod = p.get("code_challenge_method") ?? undefined;

  // Per the spec, surface errors by bouncing back to the client's redirect_uri
  // (with the original state) so their callback can display them. Fall back to
  // an inline message only when we have no usable redirect_uri to trust.
  const fail = (error: string, description: string, status = 400) => {
    if (redirectUri) {
      try {
        const u = new URL(redirectUri);
        u.searchParams.set("error", error);
        u.searchParams.set("error_description", description);
        if (state) u.searchParams.set("state", state);
        return NextResponse.redirect(u.toString());
      } catch {
        // redirect_uri wasn't a valid absolute URL — fall through to inline error
      }
    }
    return new NextResponse(`OAuth error: ${error} — ${description}`, { status });
  };

  if (responseType && responseType !== "code") {
    return fail("unsupported_response_type", "Only response_type=code is supported.");
  }
  if (!clientId || !redirectUri || !scope || !state) {
    return fail(
      "invalid_request",
      "Missing required parameter (client_id, redirect_uri, scope, state).",
    );
  }

  // Scopes arrive as `a+b+c` (→ spaces once decoded); normalize any stray
  // separators to the space-delimited form the backend expects.
  const normalizedScope = scope.replace(/[+,]+/g, " ").replace(/\s+/g, " ").trim();

  let upstream: Response;
  try {
    upstream = await fetch(`${API}/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        redirectUri,
        scope: normalizedScope,
        state,
        codeChallenge,
        codeChallengeMethod,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error("[oauth/authorize] backend request failed:", err instanceof Error ? err.message : err);
    return fail("server_error", "Could not reach the authorization server.", 502);
  }

  let json: { data?: string; message?: string } | null = null;
  try {
    json = await upstream.json();
  } catch {
    // non-JSON response — handled below
  }

  if (!upstream.ok || !json?.data) {
    // Backend rejected the request (unknown client, unregistered redirect_uri,
    // disallowed scope, …). It already validated redirect_uri, but only echo the
    // detail back through it when the request was structurally valid.
    return fail("invalid_request", json?.message ?? "Authorization request was rejected.");
  }

  // json.data is the absolute consent URL (https://aza.systems/oauth/consent?state=…)
  return NextResponse.redirect(json.data);
}
