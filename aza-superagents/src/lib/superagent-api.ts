// Strip any trailing slash so `${BASE_URL}/api/v1/...` never produces a double slash
// (a trailing slash in the Vercel NEXT_PUBLIC_API_URL would otherwise yield //api/v1).
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

// ─── Token management ────────────────────────────────────────────────────────
// Access token lives ONLY in memory; the refresh token is an httpOnly cookie re-minted
// via /api/auth/refresh. Nothing is persisted in localStorage, so an XSS cannot steal a
// long-lived session — at most a short-lived access token.
let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

/** Access token → memory; refresh token → httpOnly cookie via same-origin route. */
export async function saveTokens(access: string, refreshToken: string): Promise<void> {
  accessToken = access;
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* best-effort; the in-memory token is already cleared */
  }
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) return false;
        const body = await res.json().catch(() => null);
        if (body?.accessToken) {
          accessToken = body.accessToken as string;
          return true;
        }
        return false;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Ensures a usable access token exists (e.g. after a full page reload). */
export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true;
  return refreshAccessToken();
}

export async function logout(): Promise<void> {
  try {
    await request("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* ignore — clearing the session below is what matters */
  } finally {
    await clearTokens();
  }
}

// ─── Core fetch with auto-refresh ────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch();

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired");
    }
    res = await doFetch();
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.message ?? body.error?.message ?? msg;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type PreLoginResult =
  | { status: "authenticated" }
  | { status: "otp_required" }
  | { status: "two_factor_required"; preAuthToken: string; methods: string[]; defaultMethod: string | null };

/**
 * Starts a password login. The X-Aza-Client header marks this as the superagent portal,
 * so a genuine (non-staff) user signs in with just identifier + password; 2FA/OTP is
 * reserved for staff/admin accounts. Mirrors the merchant-portal login contract.
 */
export async function preLogin(identifier: string, password: string): Promise<PreLoginResult> {
  const body = await request<{ success: boolean; data: unknown }>("/api/v1/auth/login", {
    method: "POST",
    headers: { "X-Aza-Client": "superagent-portal" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = body.data;

  if (typeof data === "string") return { status: "otp_required" };

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.accessToken === "string" && typeof obj.refreshToken === "string") {
      await saveTokens(obj.accessToken, obj.refreshToken);
      return { status: "authenticated" };
    }
    if (typeof obj.preAuthToken === "string") {
      return {
        status: "two_factor_required",
        preAuthToken: obj.preAuthToken,
        methods: Array.isArray(obj.methods) ? (obj.methods as string[]) : [],
        defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
      };
    }
  }
  return { status: "otp_required" };
}

export async function verifyLoginOtp(identifier: string, code: string): Promise<void> {
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ identifier, code, purpose: "login" }) }
  );
  await saveTokens(body.data.accessToken, body.data.refreshToken);
}

// ─── Agent / Superagent ────────────────────────────────────────────────────────

export interface AgentMe {
  status: string; // NONE | PENDING | ACTIVE | SUSPENDED | REJECTED
  tier: string | null; // STANDARD | SUPER
  code: string | null;
  floatBalance: number | null;
  commissionAccruedGhs: number | null;
  floatLimit: number | null;
}

export async function getMe(): Promise<AgentMe> {
  const body = await request<{ success: boolean; data: AgentMe }>("/api/v1/agent/me");
  return body.data;
}

export interface FloatDistribution {
  transactionId: string;
  amount: number;
  superAgentFloatBalance: number | null;
  targetAgentCode: string | null;
  targetAgentName: string | null;
  currency: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export async function distributeFloat(data: {
  targetAgentCode: string;
  amount: number;
  idempotencyKey?: string;
}): Promise<FloatDistribution> {
  const body = await request<{ success: boolean; data: FloatDistribution }>(
    "/api/v1/superagent/distribute",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function getDistributions(page = 0, size = 20): Promise<Page<FloatDistribution>> {
  const body = await request<{ success: boolean; data: Page<FloatDistribution> }>(
    `/api/v1/superagent/distributions?page=${page}&size=${size}`
  );
  return body.data;
}
