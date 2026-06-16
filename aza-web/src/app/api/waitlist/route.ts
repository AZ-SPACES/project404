import { NextRequest, NextResponse } from "next/server";

const API_URL    = process.env.WAITLIST_API_URL;
const API_SECRET = process.env.WAITLIST_INTERNAL_SECRET;

export async function POST(request: NextRequest) {
  // Validate env config first — fail loud in dev, silent 503 in prod
  if (!API_URL || !API_SECRET) {
    console.error("[waitlist] WAITLIST_API_URL or WAITLIST_INTERNAL_SECRET is not set");
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  // Forward the real client IP so the backend's rate limiter sees the actual user.
  // Prefer x-real-ip (set by our proxy) and the right-most XFF hop — the left-most
  // entries are client-supplied and trivially spoofable for rate-limit evasion.
  const xff = request.headers.get("x-forwarded-for");
  const clientIp =
    request.headers.get("x-real-ip") ??
    xff?.split(",").map((s) => s.trim()).filter(Boolean).pop() ??
    "unknown";

  let upstream: Response;
  try {
    upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": API_SECRET,
        "X-Forwarded-For": clientIp,
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error("[waitlist] Backend request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Could not reach the server. Please try again." },
      { status: 502 }
    );
  }

  if (upstream.ok) {
    let position: number | undefined;
    try {
      const data = await upstream.json();
      if (typeof data?.data?.position === "number") position = data.data.position;
    } catch {
      // backend didn't return JSON or no position field — that's fine
    }
    return NextResponse.json({ success: true, position }, { status: 201 });
  }

  // Parse backend error without surfacing internal detail
  let code: string | undefined;
  try {
    const data = await upstream.json();
    code = data?.error?.code ?? data?.error;
  } catch {
    // ignore parse failure
  }

  if (upstream.status === 409 || code === "ALREADY_REGISTERED") {
    return NextResponse.json({ error: "already_registered" }, { status: 409 });
  }

  if (upstream.status === 400) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  console.error("[waitlist] Backend returned unexpected status:", upstream.status);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
