import { NextResponse } from "next/server";

const API_URL = process.env.WAITLIST_API_URL;

export async function GET() {
  if (!API_URL) {
    return NextResponse.json({ total: null }, { status: 503 });
  }

  // API_URL points at .../api/v1/waitlist (used for POST); derive the count endpoint from it.
  const countUrl = API_URL.replace(/\/$/, "") + "/count";

  try {
    const upstream = await fetch(countUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return NextResponse.json({ total: null }, { status: 502 });
    const json = await upstream.json();
    const total = typeof json?.data?.total === "number" ? json.data.total : null;
    return NextResponse.json({ total }, { status: 200 });
  } catch {
    return NextResponse.json({ total: null }, { status: 502 });
  }
}
