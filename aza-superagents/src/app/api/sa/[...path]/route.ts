import { NextRequest, NextResponse } from "next/server";
import { applyRotation, callAsUser } from "@/lib/server/backend";

/**
 * The portal's only route to the backend. The browser never holds a token and never calls the
 * API directly; it calls here, and this handler attaches the httpOnly access token server-side.
 *
 * The backend prefix is fixed here rather than taken from the request, so this cannot be used
 * as a general relay. That matters: a proxy that forwarded any path would hand the page the
 * user's entire API authority — every endpoint their token can reach — which would be worse
 * than the direct browser calls it replaced. `/api/sa/summary` can only ever mean
 * `/api/v1/superagent/summary`.
 */
const BACKEND_PREFIX = "/api/v1/superagent";

function resolve(segments: string[]): string | null {
  if (segments.length === 0) return null;
  // Nothing in this API needs a dot or a slash inside a segment, so anything that has one is
  // an attempt to climb out of the prefix.
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) return null;
  return `${BACKEND_PREFIX}/${segments.join("/")}`;
}

async function forward(
  request: NextRequest,
  segments: string[],
  method: string
): Promise<NextResponse> {
  const path = resolve(segments);
  if (!path) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const init: RequestInit = { method };
  if (method !== "GET" && method !== "DELETE") {
    init.body = await request.text();
  }

  const call = await callAsUser(request, `${path}${request.nextUrl.search}`, init);
  return applyRotation(NextResponse.json(call.body ?? {}, { status: call.status }), call);
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path, "GET");
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path, "POST");
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path, "PUT");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path, "PATCH");
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path, "DELETE");
}
