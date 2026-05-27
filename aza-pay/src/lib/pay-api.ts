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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

async function post<T>(path: string, payload: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
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

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  preAuthToken?: string;
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
