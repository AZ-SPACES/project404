const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface CheckoutSession {
  id: string;
  merchantId: string;
  merchantName: string | null;
  merchantHandle: string | null;
  merchantLogoUrl: string | null;
  merchantBrandColor: string | null;
  merchantCheckoutTagline: string | null;
  merchantSupportEmail: string | null;
  amount: number;
  currency: string;
  description: string | null;
  taxAmount: number | null;
  taxLabel: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  successUrl: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  preAuthToken?: string;
}

export interface PromoInfo {
  code: string;
  description: string | null;
  creditAmountGhs: number;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  } catch {
    throw new Error("Could not reach the AZA server. Check your connection and try again.");
  }
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

async function post<T>(path: string, payload: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the AZA server. Check your connection and try again.");
  }
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? body.message ?? "Request failed");
  return body.data as T;
}

async function postQuery<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST" });
  } catch {
    throw new Error("Could not reach the AZA server. Check your connection and try again.");
  }
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? body.message ?? "Request failed");
  return body.data as T;
}

export function getSession(sessionId: string): Promise<CheckoutSession> {
  return get(`/api/v1/checkout/${sessionId}`);
}

export function loginStep1(identifier: string, password: string): Promise<void> {
  return post("/api/v1/auth/login", { identifier, password });
}

export function loginStep2(identifier: string, code: string): Promise<LoginResult> {
  return post("/api/v1/auth/verify-otp", {
    identifier,
    code,
    purpose: "login",
    deviceName: "AZA Pay",
    deviceOs: "Web",
  });
}

export function confirmPayment(sessionId: string, passcode: string, token: string): Promise<CheckoutSession> {
  return post(`/api/v1/checkout/${sessionId}/confirm`, { passcode }, token);
}

// ── 2FA ──────────────────────────────────────────────────────────────────────

export function login2faTotp(preAuthToken: string, code: string): Promise<LoginResult> {
  return post("/api/v1/auth/2fa/login", { preAuthToken, code });
}

export function request2faSms(preAuthToken: string): Promise<void> {
  return postQuery(`/api/v1/auth/2fa/sms/request?preAuthToken=${encodeURIComponent(preAuthToken)}`);
}

export function request2faEmail(preAuthToken: string): Promise<void> {
  return postQuery(`/api/v1/auth/2fa/email/request?preAuthToken=${encodeURIComponent(preAuthToken)}`);
}

export function verify2faOtp(
  preAuthToken: string,
  code: string,
  method: "SMS" | "EMAIL"
): Promise<LoginResult> {
  return postQuery(
    `/api/v1/auth/2fa/otp/verify?preAuthToken=${encodeURIComponent(preAuthToken)}&code=${encodeURIComponent(code)}&method=${method}`
  );
}

// ── Promo codes ───────────────────────────────────────────────────────────────

export function validatePromoCode(code: string): Promise<PromoInfo> {
  return get(`/api/v1/promos/validate?code=${encodeURIComponent(code)}`);
}

export function redeemPromoCode(code: string, token: string): Promise<{ credited: number }> {
  return post("/api/v1/promos/redeem", { code }, token);
}
