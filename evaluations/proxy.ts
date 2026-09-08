import { NextResponse } from "next/server";

// CORS for the split deployment: the UI is served by Vercel on
// defense.aza.systems, the API by the droplet on defense-api.aza.systems. Every
// data call therefore crosses an origin, which it never did while one container
// served both.
//
// Scoring POSTs JSON, which is not a "simple" request, so the browser sends a
// preflight first — an OPTIONS this middleware has to answer itself. Without it
// the ballot save fails before Next ever routes it.
//
// The allowlist is not a security control. This application has no auth at all
// (see nginx/conf.d/defense-api.conf), so anything reachable here is reachable
// with curl regardless. It is here so a stray page on another origin cannot
// quietly drive the API from a examiner's browser.
const ALLOWED = (
  process.env.DEFENSE_ALLOWED_ORIGINS ?? "https://defense.aza.systems"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function cors(origin: string | null, res: NextResponse) {
  // Vary regardless of the outcome: the answer depends on Origin, and without
  // this a cached permitted response could be replayed for a denied one.
  res.headers.set("Vary", "Origin");
  if (origin && ALLOWED.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "content-type");
    res.headers.set("Access-Control-Max-Age", "86400");
  }
  return res;
}

export default function proxy(req: Request) {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return cors(origin, new NextResponse(null, { status: 204 }));
  }

  return cors(origin, NextResponse.next());
}

// Same-origin requests carry no Origin header and fall straight through, so the
// droplet's own UI is unaffected by any of this.
export const config = { matcher: "/api/:path*" };
