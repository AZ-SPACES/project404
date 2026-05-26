const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Token management ────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aza_merchant_token");
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("aza_merchant_token", accessToken);
  localStorage.setItem("aza_merchant_refresh_token", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("aza_merchant_token");
  localStorage.removeItem("aza_merchant_refresh_token");
}

// ─── Core fetch with auto-refresh ────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      const refreshToken = localStorage.getItem("aza_merchant_refresh_token");
      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
      try {
        const r = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const body = await r.json();
        if (r.ok && body.success) {
          saveTokens(body.data.accessToken, body.data.refreshToken);
          isRefreshing = false;
          onTokenRefreshed(body.data.accessToken);
        } else {
          throw new Error("Refresh failed");
        }
      } catch {
        isRefreshing = false;
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }
    return new Promise((resolve) => {
      refreshSubscribers.push((newToken) => {
        resolve(
          request(path, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newToken}`,
            },
          })
        );
      });
    });
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.message ?? body.error ?? msg;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type MerchantStatus =
  | "PENDING_KYB"
  | "KYB_SUBMITTED"
  | "KYB_UNDER_REVIEW"
  | "MORE_INFO_REQUIRED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";

export interface Merchant {
  id: string;
  userId: string;
  businessName: string;
  businessHandle: string;
  businessEmail: string | null;
  businessPhone: string | null;
  businessDescription: string | null;
  logoUrl: string | null;
  category: string | null;
  status: MerchantStatus;
  rejectionReason: string | null;
  moreInfoRequest: string | null;
  balance: number;
  currency: string;
  totalVolume: number;
  feeRateBps: number;
  createdAt: string;
  activatedAt: string | null;
}

export interface ReportSummary {
  todayRevenue: number;
  sevenDayRevenue: number;
  thirtyDayRevenue: number;
  allTimeRevenue: number;
  todayPayments: number;
  sevenDayPayments: number;
  thirtyDayPayments: number;
  allTimePayments: number;
  successRate: number;
  dailySeries: { date: string; revenue: number; count: number }[];
}

export interface CheckoutSession {
  id: string;
  merchantId: string;
  merchantName: string | null;
  merchantHandle: string | null;
  amount: number;
  currency: string;
  description: string | null;
  metadata: string | null;
  successUrl: string | null;
  cancelUrl: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  customerId: string | null;
  platformFee: number | null;
  netAmount: number | null;
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

export interface ApiKey {
  id: string;
  label: string | null;
  keyPrefix: string;
  environment: "TEST" | "LIVE";
  keyType: string | null;
  scopes: string | null;
  ipWhitelist: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  lastUsedUserAgent: string | null;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  fullKey?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  signingSecret?: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  httpStatus: number | null;
  attemptNumber: number;
  duration: number | null;
  createdAt: string;
  nextRetryAt: string | null;
}

export interface MerchantPayout {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  note: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface BalanceInfo {
  balance: number;
  currency: string;
  totalVolume: number;
}

export interface KybStatus {
  status: string;
  registrationNumber: string | null;
  businessType: string | null;
  registeredAddress: string | null;
  city: string | null;
  taxIdNumber: string | null;
  website: string | null;
  ownerFullName: string | null;
  ownerIdType: string | null;
  rejectionReason: string | null;
  moreInfoRequest: string | null;
  documents: KybDocument[];
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface KybDocument {
  id: string;
  type: string;
  fileName: string | null;
  url: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function preLogin(identifier: string, password: string): Promise<void> {
  await request<{ success: boolean; data: string }>(
    "/api/v1/auth/login",
    { method: "POST", body: JSON.stringify({ identifier, password }) }
  );
}

export async function verifyLoginOtp(identifier: string, code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ identifier, code, purpose: "login" }) }
  );
  saveTokens(body.data.accessToken, body.data.refreshToken);
  return body.data;
}

// ─── Merchant profile ────────────────────────────────────────────────────────

export async function getMe(): Promise<Merchant | null> {
  const body = await request<{ success: boolean; data: Merchant | null }>("/api/v1/merchant/me");
  return body.data ?? null;
}

export async function updateMe(data: {
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessDescription?: string;
  logoUrl?: string;
}): Promise<Merchant> {
  const body = await request<{ success: boolean; data: Merchant }>("/api/v1/merchant/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return body.data;
}

export async function registerMerchant(data: {
  businessName: string;
  businessHandle: string;
  businessEmail?: string;
  businessPhone?: string;
  businessDescription?: string;
  category?: string;
}): Promise<Merchant> {
  const body = await request<{ success: boolean; data: Merchant }>(
    "/api/v1/merchant/register",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function checkHandle(handle: string): Promise<boolean> {
  const body = await request<{ success: boolean; data: boolean }>(
    `/api/v1/merchant/check-handle?handle=${encodeURIComponent(handle)}`
  );
  return body.data;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export async function getBalance(): Promise<BalanceInfo> {
  const body = await request<{ success: boolean; data: BalanceInfo }>("/api/v1/merchant/balance");
  return body.data;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getReportSummary(): Promise<ReportSummary> {
  const body = await request<{ success: boolean; data: ReportSummary }>("/api/v1/merchant/reports/summary");
  return body.data;
}

// ─── Checkout Sessions ───────────────────────────────────────────────────────

export async function getSessions(params: {
  page?: number;
  size?: number;
  status?: string;
  from?: string;
  to?: string;
}): Promise<Page<CheckoutSession>> {
  const q = new URLSearchParams();
  if (params.page !== undefined) q.set("page", String(params.page));
  if (params.size !== undefined) q.set("size", String(params.size));
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const body = await request<{ success: boolean; data: Page<CheckoutSession> }>(
    `/api/v1/merchant/sessions?${q}`
  );
  return body.data;
}

export async function createSession(data: {
  amount: number;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: string;
  idempotencyKey?: string;
}): Promise<CheckoutSession> {
  const body = await request<{ success: boolean; data: CheckoutSession }>(
    "/api/v1/merchant/sessions",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function expireSession(id: string): Promise<void> {
  await request(`/api/v1/merchant/sessions/${id}/expire`, { method: "POST" });
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export async function getApiKeys(): Promise<ApiKey[]> {
  const body = await request<{ success: boolean; data: ApiKey[] }>("/api/v1/merchant/api-keys");
  return body.data;
}

export async function createApiKey(environment: "TEST" | "LIVE", label?: string): Promise<ApiKey> {
  const body = await request<{ success: boolean; data: ApiKey }>(
    "/api/v1/merchant/api-keys",
    { method: "POST", body: JSON.stringify({ environment, label }) }
  );
  return body.data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await request(`/api/v1/merchant/api-keys/${id}`, { method: "DELETE" });
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

function parseWebhookEvents(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

export async function getWebhooks(): Promise<WebhookEndpoint[]> {
  const body = await request<{ success: boolean; data: Array<{
    id: string; url: string; signingSecret?: string; isActive: boolean; events: string; createdAt: string;
  }> }>("/api/v1/merchant/webhooks");
  return body.data.map((ep) => ({ ...ep, events: parseWebhookEvents(ep.events) }));
}

export async function createWebhook(data: {
  url: string;
  events: string[];
}): Promise<WebhookEndpoint> {
  const body = await request<{ success: boolean; data: {
    id: string; url: string; signingSecret?: string; isActive: boolean; events: string; createdAt: string;
  } }>("/api/v1/merchant/webhooks", {
    method: "POST",
    body: JSON.stringify({ url: data.url, events: data.events.join(",") }),
  });
  return { ...body.data, events: parseWebhookEvents(body.data.events) };
}

export async function updateWebhook(
  id: string,
  data: { url?: string; events?: string[]; isActive?: boolean }
): Promise<WebhookEndpoint> {
  const payload: Record<string, unknown> = {};
  if (data.url !== undefined) payload.url = data.url;
  if (data.events !== undefined) payload.events = data.events.join(",");
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  const body = await request<{ success: boolean; data: {
    id: string; url: string; signingSecret?: string; isActive: boolean; events: string; createdAt: string;
  } }>(`/api/v1/merchant/webhooks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return { ...body.data, events: parseWebhookEvents(body.data.events) };
}

export async function deleteWebhook(id: string): Promise<void> {
  await request(`/api/v1/merchant/webhooks/${id}`, { method: "DELETE" });
}

export async function getWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  const body = await request<{ success: boolean; data: WebhookDelivery[] }>(
    `/api/v1/merchant/webhooks/${id}/deliveries`
  );
  return body.data;
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export async function getPayouts(page = 0, size = 20): Promise<Page<MerchantPayout>> {
  const body = await request<{ success: boolean; data: Page<MerchantPayout> }>(
    `/api/v1/merchant/payouts?page=${page}&size=${size}`
  );
  return body.data;
}

export async function requestPayout(data: {
  amount: number;
  passcode: string;
  note?: string;
}): Promise<MerchantPayout> {
  const body = await request<{ success: boolean; data: MerchantPayout }>("/api/v1/merchant/payouts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return body.data;
}

// ─── KYB ─────────────────────────────────────────────────────────────────────

export async function getKyb(): Promise<KybStatus> {
  const body = await request<{ success: boolean; data: KybStatus }>("/api/v1/merchant/kyb");
  return body.data;
}

export async function saveKyb(data: {
  registrationNumber?: string;
  businessType: string;
  registeredAddress?: string;
  city?: string;
  taxIdNumber?: string;
  website?: string;
  ownerFullName: string;
  ownerIdType?: string;
  ownerIdNumber?: string;
}): Promise<KybStatus> {
  const body = await request<{ success: boolean; data: KybStatus }>("/api/v1/merchant/kyb", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return body.data;
}

export async function submitKyb(): Promise<void> {
  await request("/api/v1/merchant/kyb/submit", { method: "POST" });
}

export async function uploadKybDocument(
  file: File,
  type: string
): Promise<KybDocument> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  const res = await fetch(`${BASE_URL}/api/v1/merchant/kyb/document`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  const body = await res.json();
  return body.data;
}

// ─── Logo upload ─────────────────────────────────────────────────────────────

export async function uploadLogo(file: File): Promise<Merchant> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/v1/merchant/logo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  const body = await res.json();
  return body.data;
}
