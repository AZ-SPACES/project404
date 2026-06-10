import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CSP_BASE = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.aza.systems https://www.chatbase.co https://vitals.vercel-insights.com",
  "frame-src https://www.chatbase.co",
  "frame-ancestors 'none'",
].join('; ');

// Swagger UI requires 'unsafe-eval' for its internal code parsing.
// Scope it only to the api-explorer route so the global CSP stays tighter.
const CSP_SWAGGER = CSP_BASE.replace(
  "default-src 'self'",
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
) + "; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.chatbase.co";

const CSP_DEFAULT =
  CSP_BASE + "; script-src 'self' 'unsafe-inline' https://www.chatbase.co";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // DENY matches frame-ancestors 'none' — SAMEORIGIN would contradict it
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // 2-year HSTS — ready for preload list submission
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set(
    'Content-Security-Policy',
    pathname.startsWith('/developers/api-explorer') ? CSP_SWAGGER : CSP_DEFAULT
  );

  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
