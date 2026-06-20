const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Token management ────────────────────────────────────────────────────────

// Access token lives ONLY in memory; the refresh token is an httpOnly cookie re-minted
// via /api/auth/refresh. Nothing is persisted in localStorage, so an XSS cannot steal a
// long-lived session — at most a ~15-minute access token.
let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

/** Access token → memory (synchronously); refresh token → httpOnly cookie via same-origin route. */
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

/** Re-mints the in-memory access token from the httpOnly refresh cookie. */
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
  // Branding
  brandColor: string | null;
  checkoutTagline: string | null;
  supportEmail: string | null;
  // Tax
  taxEnabled: boolean;
  taxRate: number | null;
  taxLabel: string | null;
  // Auto-payout
  autoPayoutEnabled: boolean;
  autoPayoutSchedule: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  autoPayoutMinBalance: number | null;
  autoPayoutDay: number | null;
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
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
  testMode?: boolean; // sandbox session created with an aza_test_ key — no real funds moved
  customerId: string | null;
  platformFee: number | null;
  netAmount: number | null;
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
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

export async function signup(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<void> {
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/signup",
    { method: "POST", body: JSON.stringify(data) }
  );
  await saveTokens(body.data.accessToken, body.data.refreshToken);
}

export type PreLoginResult =
  | { status: "authenticated" }
  | { status: "otp_required" }
  | { status: "two_factor_required"; preAuthToken: string; methods: string[]; defaultMethod: string | null };

/**
 * Starts a password login. The X-Aza-Client header tells the backend this is the merchant
 * portal, so a genuine (non-staff) merchant signs in with just email/phone + password — 2FA is
 * reserved for the QR (AZA App) sign-in. The backend (/api/v1/auth/login) responds either with:
 *  - an auth payload with access/refresh tokens — login is complete (the normal merchant path)
 *  - a plain string ("OTP sent…") for accounts that require an emailed/SMS login OTP (e.g. admins)
 *  - a 2FA-pending payload (preAuthToken) — only for staff/admin accounts via this portal
 * This returns a discriminated result so the caller knows which step to show next.
 */
export async function preLogin(identifier: string, password: string): Promise<PreLoginResult> {
  const body = await request<{ success: boolean; data: unknown }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      headers: { "X-Aza-Client": "merchant-portal" },
      body: JSON.stringify({ identifier, password }),
    }
  );
  const data = body.data;

  // Accounts that get an emailed/SMS OTP on login: backend returns a plain string.
  if (typeof data === "string") {
    return { status: "otp_required" };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Regular account, no 2FA: tokens are returned directly — login is already complete.
    if (typeof obj.accessToken === "string" && typeof obj.refreshToken === "string") {
      await saveTokens(obj.accessToken, obj.refreshToken);
      return { status: "authenticated" };
    }
    // 2FA-enabled account: a second factor is required before tokens are issued.
    if (typeof obj.preAuthToken === "string") {
      return {
        status: "two_factor_required",
        preAuthToken: obj.preAuthToken,
        methods: Array.isArray(obj.methods) ? (obj.methods as string[]) : [],
        defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
      };
    }
  }

  // Unrecognised shape — fall back to asking for an OTP rather than silently failing.
  return { status: "otp_required" };
}

export async function verifyLoginOtp(identifier: string, code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ identifier, code, purpose: "login" }) }
  );
  await saveTokens(body.data.accessToken, body.data.refreshToken);
  return body.data;
}

export type OtpTwoFactorMethod = "EMAIL" | "SMS";

/**
 * Picks an emailed/SMS 2FA method from the account's available methods. The login step does
 * NOT send a code for 2FA-enabled accounts — the caller must dispatch one for EMAIL/SMS. Returns
 * null when the account only supports non-code methods (APP/TOTP/PASSKEY), which this portal
 * handles via the AZA App (QR) tab instead.
 */
export function pickOtpTwoFactorMethod(
  methods: string[],
  defaultMethod: string | null
): OtpTwoFactorMethod | null {
  if (defaultMethod === "EMAIL" || defaultMethod === "SMS") return defaultMethod;
  if (methods.includes("EMAIL")) return "EMAIL";
  if (methods.includes("SMS")) return "SMS";
  return null;
}

/** Dispatches the 2FA login code to the account's email or phone for the given preAuthToken. */
export async function requestTwoFactorOtp(
  preAuthToken: string,
  method: OtpTwoFactorMethod
): Promise<void> {
  const path = method === "SMS" ? "/api/v1/auth/2fa/sms/request" : "/api/v1/auth/2fa/email/request";
  await request(`${path}?preAuthToken=${encodeURIComponent(preAuthToken)}`, { method: "POST" });
}

/** Verifies the emailed/SMS 2FA code and, on success, stores the returned tokens. */
export async function verifyTwoFactorOtp(
  preAuthToken: string,
  code: string,
  method: OtpTwoFactorMethod
): Promise<{ accessToken: string; refreshToken: string }> {
  const qs = new URLSearchParams({ preAuthToken, code, method }).toString();
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    `/api/v1/auth/2fa/otp/verify?${qs}`,
    { method: "POST" }
  );
  await saveTokens(body.data.accessToken, body.data.refreshToken);
  return body.data;
}

// ─── QR Login ────────────────────────────────────────────────────────────────

export interface QrLoginSession {
  challengeToken: string;
  sessionSecret: string;
  qrImageBase64: string;
  expiresAt: string;
  ttlSeconds: number;
}

export async function initiateQrLogin(): Promise<QrLoginSession> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/qr-login/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteType: "MERCHANT" }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Failed to generate QR");
  return body.data as QrLoginSession;
}

export async function pollQrLoginStatus(challengeToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/qr-login/status/${challengeToken}`);
  const body = await res.json();
  if (!res.ok || !body.success) return "EXPIRED";
  return body.data.status as string;
}

export async function completeQrLogin(
  challengeToken: string,
  sessionSecret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/qr-login/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken, sessionSecret }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "QR login failed");
  await saveTokens(body.data.accessToken, body.data.refreshToken);
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
  // Branding
  brandColor?: string;
  checkoutTagline?: string;
  supportEmail?: string;
  // Tax
  taxEnabled?: boolean;
  taxRate?: number;
  taxLabel?: string;
  // Auto-payout (updated separately via /auto-payout endpoint)
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
  q?: string;
  mode?: "live" | "test"; // omit for both
}): Promise<Page<CheckoutSession>> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  if (params.status) qs.set("status", params.status);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.q) qs.set("q", params.q);
  if (params.mode) qs.set("mode", params.mode);
  const body = await request<{ success: boolean; data: Page<CheckoutSession> }>(
    `/api/v1/merchant/sessions?${qs}`
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

export async function createApiKey(data: {
  environment: "TEST" | "LIVE";
  label?: string;
  type?: "SECRET" | "RESTRICTED";
  scopes?: string;
  ipWhitelist?: string;
  expirationDays?: number;
}): Promise<ApiKey> {
  const body = await request<{ success: boolean; data: ApiKey }>(
    "/api/v1/merchant/api-keys",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updateApiKey(
  id: string,
  data: { label?: string; ipWhitelist?: string; scopes?: string }
): Promise<ApiKey> {
  const body = await request<{ success: boolean; data: ApiKey }>(
    `/api/v1/merchant/api-keys/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function rollApiKey(id: string, expirationHours?: number): Promise<ApiKey> {
  const body = await request<{ success: boolean; data: ApiKey }>(
    `/api/v1/merchant/api-keys/${id}/roll`,
    { method: "POST", body: JSON.stringify({ expirationHours }) }
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

export interface ApiLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function getApiLogs(page = 0, size = 20): Promise<Page<ApiLog>> {
  const body = await request<{ success: boolean; data: Page<ApiLog> }>(
    `/api/v1/merchant/api-keys/logs?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Refund ──────────────────────────────────────────────────────────────────

export async function refundSession(id: string): Promise<CheckoutSession> {
  const body = await request<{ success: boolean; data: CheckoutSession }>(
    `/api/v1/merchant/sessions/${id}/refund`,
    { method: "POST" }
  );
  return body.data;
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalPayments: number;
  totalSpend: number;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
}

export async function getCustomers(page = 0, size = 20): Promise<Page<Customer>> {
  const body = await request<{ success: boolean; data: Page<Customer> }>(
    `/api/v1/merchant/customers?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Disputes ────────────────────────────────────────────────────────────────

export interface MerchantDispute {
  id: string;
  referenceId: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  description: string | null;
  status: string;
  merchantResponse: string | null;
  merchantRespondedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function getMerchantDisputes(page = 0, size = 20): Promise<Page<MerchantDispute>> {
  const body = await request<{ success: boolean; data: Page<MerchantDispute> }>(
    `/api/v1/merchant/disputes?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export interface MerchantAuditLog {
  id: string;
  actorEmail: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export async function getAuditLogs(page = 0, size = 20): Promise<Page<MerchantAuditLog>> {
  const body = await request<{ success: boolean; data: Page<MerchantAuditLog> }>(
    `/api/v1/merchant/audit-logs?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  referenceId: string | null;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  description: string | null;
  dueDate: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED" | "OVERDUE";
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
}

export async function getInvoices(page = 0, size = 20): Promise<Page<Invoice>> {
  const body = await request<{ success: boolean; data: Page<Invoice> }>(
    `/api/v1/merchant/invoices?page=${page}&size=${size}`
  );
  return body.data;
}

export async function createInvoice(data: {
  customerName: string;
  customerEmail: string;
  amount: number;
  currency?: string;
  description?: string;
  dueDate?: string;
}): Promise<Invoice> {
  const body = await request<{ success: boolean; data: Invoice }>(
    "/api/v1/merchant/invoices",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updateInvoice(id: string, data: {
  customerName?: string;
  customerEmail?: string;
  amount?: number;
  description?: string;
  dueDate?: string;
}): Promise<Invoice> {
  const body = await request<{ success: boolean; data: Invoice }>(
    `/api/v1/merchant/invoices/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const body = await request<{ success: boolean; data: Invoice }>(
    `/api/v1/merchant/invoices/${id}`,
    { method: "DELETE" }
  );
  return body.data;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const body = await request<{ success: boolean; data: Invoice }>(
    `/api/v1/merchant/invoices/${id}/send`,
    { method: "POST" }
  );
  return body.data;
}

// ─── Team Members ────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  email: string;
  userId: string | null;
  role: "ADMIN" | "DEVELOPER" | "ANALYST" | "SUPPORT";
  status: "INVITED" | "ACTIVE" | "REMOVED";
  invitedAt: string;
  joinedAt: string | null;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const body = await request<{ success: boolean; data: TeamMember[] }>(
    "/api/v1/merchant/team"
  );
  return body.data;
}

export async function inviteTeamMember(data: {
  email: string;
  role: string;
}): Promise<TeamMember> {
  const body = await request<{ success: boolean; data: TeamMember }>(
    "/api/v1/merchant/team/invite",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updateTeamRole(id: string, role: string): Promise<TeamMember> {
  const body = await request<{ success: boolean; data: TeamMember }>(
    `/api/v1/merchant/team/${id}/role`,
    { method: "PUT", body: JSON.stringify({ role }) }
  );
  return body.data;
}

export async function removeTeamMember(id: string): Promise<void> {
  await request(`/api/v1/merchant/team/${id}`, { method: "DELETE" });
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  active: boolean;
  createdAt: string;
}

export async function getPlans(): Promise<Plan[]> {
  const body = await request<{ success: boolean; data: Plan[] }>(
    "/api/v1/merchant/plans"
  );
  return body.data;
}

export async function createPlan(data: {
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  interval: string;
}): Promise<Plan> {
  const body = await request<{ success: boolean; data: Plan }>(
    "/api/v1/merchant/plans",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updatePlan(id: string, data: {
  name?: string;
  description?: string;
  active?: boolean;
}): Promise<Plan> {
  const body = await request<{ success: boolean; data: Plan }>(
    `/api/v1/merchant/plans/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function deletePlan(id: string): Promise<void> {
  await request(`/api/v1/merchant/plans/${id}`, { method: "DELETE" });
}

export async function getPlanSubscriptions(planId: string, page = 0, size = 20): Promise<Page<Subscription>> {
  const body = await request<{ success: boolean; data: Page<Subscription> }>(
    `/api/v1/merchant/plans/${planId}/subscriptions?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  planId: string;
  merchantId: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: "ACTIVE" | "CANCELLED" | "PAUSED";
  nextBillingAt: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

export async function getSubscriptions(page = 0, size = 20): Promise<Page<Subscription>> {
  const body = await request<{ success: boolean; data: Page<Subscription> }>(
    `/api/v1/merchant/subscriptions?page=${page}&size=${size}`
  );
  return body.data;
}

export async function createSubscription(data: {
  planId: string;
  customerEmail: string;
  customerName?: string;
}): Promise<Subscription> {
  const body = await request<{ success: boolean; data: Subscription }>(
    "/api/v1/merchant/subscriptions",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function cancelSubscription(id: string): Promise<void> {
  await request(`/api/v1/merchant/subscriptions/${id}`, { method: "DELETE" });
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationPreferences {
  emailPaymentReceived: boolean;
  emailDisputeOpened: boolean;
  emailPayoutCompleted: boolean;
  emailPayoutFailed: boolean;
  emailInvoicePaid: boolean;
  emailWeeklySummary: boolean;
  emailApiKeyCreated: boolean;
  emailLowBalance: boolean;
  lowBalanceThreshold: number | null;
  updatedAt: string | null;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const body = await request<{ success: boolean; data: NotificationPreferences }>(
    "/api/v1/merchant/notification-preferences"
  );
  return body.data;
}

export async function updateNotificationPreferences(
  data: Partial<Omit<NotificationPreferences, "updatedAt">>
): Promise<NotificationPreferences> {
  const body = await request<{ success: boolean; data: NotificationPreferences }>(
    "/api/v1/merchant/notification-preferences",
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

// ─── Auto-payout Settings ─────────────────────────────────────────────────────

export interface AutoPayoutSettings {
  autoPayoutEnabled: boolean;
  autoPayoutSchedule: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  autoPayoutMinBalance: number | null;
  autoPayoutDay: number | null;
}

export async function getAutoPayoutSettings(): Promise<AutoPayoutSettings> {
  const body = await request<{ success: boolean; data: AutoPayoutSettings }>(
    "/api/v1/merchant/auto-payout"
  );
  return body.data;
}

export async function updateAutoPayoutSettings(data: {
  autoPayoutEnabled?: boolean;
  autoPayoutSchedule?: string;
  autoPayoutMinBalance?: number;
  autoPayoutDay?: number;
}): Promise<AutoPayoutSettings> {
  const body = await request<{ success: boolean; data: AutoPayoutSettings }>(
    "/api/v1/merchant/auto-payout",
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export interface SettlementItem {
  id: string;
  checkoutSessionId: string;
  amount: number;
  fee: number;
  net: number;
  transactionDate: string;
}

export interface Settlement {
  id: string;
  merchantId: string;
  payoutId: string | null;
  grossAmount: number;
  feeTotal: number;
  netAmount: number;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: "PENDING" | "SETTLED";
  createdAt: string;
  settledAt: string | null;
}

export interface SettlementDetail extends Settlement {
  items: SettlementItem[];
}

export async function getSettlements(page = 0, size = 20): Promise<Page<Settlement>> {
  const body = await request<{ success: boolean; data: Page<Settlement> }>(
    `/api/v1/merchant/settlements?page=${page}&size=${size}`
  );
  return body.data;
}

export async function getSettlement(id: string): Promise<SettlementDetail> {
  const body = await request<{ success: boolean; data: SettlementDetail }>(
    `/api/v1/merchant/settlements/${id}`
  );
  return body.data;
}

// ─── Discount Codes ───────────────────────────────────────────────────────────

export interface DiscountCode {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export async function getDiscountCodes(): Promise<DiscountCode[]> {
  const body = await request<{ success: boolean; data: DiscountCode[] }>(
    "/api/v1/merchant/discount-codes"
  );
  return body.data;
}

export async function createDiscountCode(data: {
  code?: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses?: number;
  expiresAt?: string;
}): Promise<DiscountCode> {
  const body = await request<{ success: boolean; data: DiscountCode }>(
    "/api/v1/merchant/discount-codes",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updateDiscountCode(id: string, data: {
  active?: boolean;
  maxUses?: number;
  expiresAt?: string;
}): Promise<DiscountCode> {
  const body = await request<{ success: boolean; data: DiscountCode }>(
    `/api/v1/merchant/discount-codes/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function deleteDiscountCode(id: string): Promise<void> {
  await request(`/api/v1/merchant/discount-codes/${id}`, { method: "DELETE" });
}

// ─── Bulk Transfers ───────────────────────────────────────────────────────────

export interface BulkTransferItem {
  id: string;
  recipientIdentifier: string;
  amount: number;
  note: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  failureReason: string | null;
  processedAt: string | null;
}

export interface BulkTransfer {
  id: string;
  merchantId: string;
  note: string | null;
  totalAmount: number;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
  createdAt: string;
  processedAt: string | null;
}

export interface BulkTransferDetail extends BulkTransfer {
  items: BulkTransferItem[];
}

export async function getBulkTransfers(page = 0, size = 20): Promise<Page<BulkTransfer>> {
  const body = await request<{ success: boolean; data: Page<BulkTransfer> }>(
    `/api/v1/merchant/bulk-transfers?page=${page}&size=${size}`
  );
  return body.data;
}

export async function getBulkTransfer(id: string): Promise<BulkTransferDetail> {
  const body = await request<{ success: boolean; data: BulkTransferDetail }>(
    `/api/v1/merchant/bulk-transfers/${id}`
  );
  return body.data;
}

export async function createBulkTransfer(data: {
  note?: string;
  items: { recipientIdentifier: string; amount: number; note?: string }[];
}): Promise<BulkTransfer> {
  const body = await request<{ success: boolean; data: BulkTransfer }>(
    "/api/v1/merchant/bulk-transfers",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  days: number;
  todayRevenue: number;
  sevenDayRevenue: number;
  // Current period
  periodRevenue: number;
  prevPeriodRevenue: number;
  revenueChange: number;
  // Legacy fields (kept for compatibility)
  thirtyDayRevenue: number;
  allTimeRevenue: number;
  periodSessionCount: number;
  periodCompletedCount: number;
  completedChange: number;
  thirtyDaySessionCount: number;
  thirtyDayCompletedCount: number;
  conversionRate: number;
  prevConversionRate: number;
  avgOrderValue: number;
  dailySeries: { date: string; revenue: number; count: number }[];
  topCustomers: { userId: string; displayName: string; totalPaid: number; paymentCount: number }[];
}

export async function getAnalytics(days = 30): Promise<AnalyticsSummary> {
  const body = await request<{ success: boolean; data: AnalyticsSummary }>(
    `/api/v1/merchant/analytics?days=${days}`
  );
  return body.data;
}

// ─── Customer sessions ────────────────────────────────────────────────────────

export async function getCustomerSessions(customerId: string, page = 0, size = 20): Promise<Page<CheckoutSession>> {
  const body = await request<{ success: boolean; data: Page<CheckoutSession> }>(
    `/api/v1/merchant/customers/${customerId}/sessions?page=${page}&size=${size}`
  );
  return body.data;
}

// ─── Dispute response ─────────────────────────────────────────────────────────

export async function respondToDispute(disputeId: string, response: string): Promise<MerchantDispute> {
  const body = await request<{ success: boolean; data: MerchantDispute }>(
    `/api/v1/merchant/disputes/${disputeId}/respond`,
    { method: "POST", body: JSON.stringify({ response }) }
  );
  return body.data;
}

// ─── Product catalog ──────────────────────────────────────────────────────────

export interface MerchantProduct {
  id: string;
  merchantId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  sku: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getProducts(page = 0, size = 20, active?: boolean): Promise<Page<MerchantProduct>> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (active !== undefined) q.set("active", String(active));
  const body = await request<{ success: boolean; data: Page<MerchantProduct> }>(
    `/api/v1/merchant/products?${q}`
  );
  return body.data;
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  sku?: string;
}): Promise<MerchantProduct> {
  const body = await request<{ success: boolean; data: MerchantProduct }>(
    "/api/v1/merchant/products",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function updateProduct(id: string, data: Partial<{
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  sku: string | null;
  active: boolean;
}>): Promise<MerchantProduct> {
  const body = await request<{ success: boolean; data: MerchantProduct }>(
    `/api/v1/merchant/products/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await request(`/api/v1/merchant/products/${id}`, { method: "DELETE" });
}

// ─── Chatbase identity token ──────────────────────────────────────────────────

export async function getChatbaseToken(): Promise<string | null> {
  try {
    const body = await request<{ success: boolean; data: { token: string } }>("/api/v1/ai/chatbase-token");
    return body.data?.token ?? null;
  } catch {
    return null;
  }
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

// ─── Mobile KYB handoff ───────────────────────────────────────────────────────

export async function createMobileHandoff(): Promise<{ token: string }> {
  const body = await request<{ success: boolean; data: { token: string } }>("/api/v1/merchant/kyb/mobile-handoff", { method: "POST" });
  return body.data;
}

export interface MobileKybContext {
  businessName: string;
  pendingDocTypes: string[];
  uploadedDocTypes: string[];
}

export async function getMobileKybContext(token: string): Promise<MobileKybContext> {
  const res = await fetch(`${BASE_URL}/api/v1/public/kyb-mobile/${token}`);
  if (!res.ok) throw new Error("Invalid or expired mobile session");
  const body = await res.json();
  return body.data;
}

export async function getMobileKybStatus(token: string): Promise<{ pendingDocTypes: string[]; uploadedDocTypes: string[]; complete: boolean }> {
  const res = await fetch(`${BASE_URL}/api/v1/public/kyb-mobile/${token}/status`);
  if (!res.ok) throw new Error("Invalid or expired mobile session");
  const body = await res.json();
  return body.data;
}

export async function uploadMobileKybDocument(token: string, file: File, docType: string): Promise<KybDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", docType);
  const res = await fetch(`${BASE_URL}/api/v1/public/kyb-mobile/${token}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  const body = await res.json();
  return body.data;
}
