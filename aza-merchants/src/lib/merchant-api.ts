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
  /** Your own reference, echoed back unchanged. */
  reference: string | null;
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
  /** "AUTOMATIC" (settles at payment) or "MANUAL" (held until you release it). */
  release?: "AUTOMATIC" | "MANUAL";
  /** Present on manual-release sessions once the payer has paid. */
  hold?: Hold | null;
}

export interface HoldRecipient {
  recipient: string;
  amount: number;
  releasedAmount: number;
  status: "PENDING" | "RELEASED" | "RELEASE_FAILED" | "REFUNDED";
  failureReason: string | null;
}

export interface Hold {
  id: string;
  status: "HELD" | "RELEASED" | "REFUNDED" | "PARTIALLY_SETTLED" | "FROZEN";
  amount: number;
  releasedAmount: number;
  refundedAmount: number;
  remainingAmount: number;
  azaFee: number;
  heldAt: string;
  /** After this the payer is automatically refunded. */
  expiresAt: string;
  resolvedAt: string | null;
  recipients: HoldRecipient[];
}

/** Release a held payment. Requires an idempotency key — this moves money. */
export async function releaseHold(sessionId: string, idempotencyKey: string, reason?: string): Promise<CheckoutSession> {
  const body = await request<{ success: boolean; data: CheckoutSession }>(
    `/api/v1/merchant/sessions/${sessionId}/release`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason: reason || undefined }),
    }
  );
  return body.data;
}

/** Return a held payment to the payer. Cannot fail while the money is held. */
export async function refundHold(sessionId: string, idempotencyKey: string, reason?: string): Promise<CheckoutSession> {
  const body = await request<{ success: boolean; data: CheckoutSession }>(
    `/api/v1/merchant/sessions/${sessionId}/hold/refund`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason: reason || undefined }),
    }
  );
  return body.data;
}

/**
 * Held payments only. The release filter is applied server-side: filtering a page after the
 * database has paginated it produces empty-looking pages while more holds exist, and a page
 * count for the wrong rows.
 */
export async function getHeldSessions(page = 0, size = 20): Promise<Page<CheckoutSession>> {
  const body = await request<{ success: boolean; data: Page<CheckoutSession> }>(
    `/api/v1/merchant/sessions?status=COMPLETED&release=MANUAL&page=${page}&size=${size}`
  );
  return body.data;
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

/** OAuth 2.0 client application ("Sign in with AZA"). */
export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string | null; // only present on create or rotate — shown once
  appName: string;
  appDescription: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  redirectUris: string[];
  allowedScopes: string[];
  active: boolean;
  createdAt: string | null;
  merchantId: string | null;
  merchantName: string | null;
}

export const OAUTH_SCOPES: { value: string; label: string; description: string }[] = [
  { value: "identity", label: "Identity", description: "Name, username and profile photo" },
  { value: "email", label: "Email", description: "Account email address" },
  { value: "phone", label: "Phone", description: "Account phone number" },
  { value: "wallet:read", label: "Wallet balance", description: "Read-only wallet balance & currency" },
  { value: "payment", label: "Payments", description: "Charge the user's wallet (requires linking your merchant account)" },
];

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

// ─── Payment mandates (direct debit) ────────────────────────────────────────

export interface Mandate {
  id: string;
  merchantId: string;
  perChargeLimit: number;
  periodLimit: number | null;
  periodType: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  periodSpent: number;
  periodResetAt: string | null;
  expiresAt: string | null;
  reference: string;
  status: "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
  sourceType: "MINI_APP" | "OAUTH";
  sourceId: string;
  lastChargedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface MandateChargeRecord {
  id: string;
  mandateId: string;
  amount: number;
  status: "COMPLETED" | "FAILED";
  transactionId: string | null;
  failureReason: string | null;
  createdAt: string;
}

export function getMandates(page = 0, size = 20): Promise<Page<Mandate>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<{ success: boolean; data: Page<Mandate> }>(`/api/v1/merchant/mandates?${params}`).then((b) => b.data);
}

export function getMandateCharges(mandateId: string, page = 0, size = 20): Promise<Page<MandateChargeRecord>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<{ success: boolean; data: Page<MandateChargeRecord> }>(
    `/api/v1/merchant/mandates/${mandateId}/charges?${params}`
  ).then((b) => b.data);
}

/** Debits the mandate's payer on demand — no passcode prompt, they already approved this mandate. */
export function chargeMandate(
  mandateId: string,
  amount: number,
  reference: string,
  idempotencyKey: string
): Promise<MandateChargeRecord> {
  return request<{ success: boolean; data: MandateChargeRecord }>(`/api/v1/merchant/mandates/${mandateId}/charge`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ amount, reference }),
  }).then((b) => b.data);
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

export type LoginOtpResult =
  | { status: "authenticated" }
  | { status: "two_factor_required"; preAuthToken: string; methods: string[]; defaultMethod: string | null };

/**
 * Verifies the login OTP the backend sent during /auth/login. An account that ALSO has 2FA
 * enabled gets a preAuthToken here instead of tokens — the second factor still has to be
 * cleared — so this returns a discriminated result rather than assuming tokens came back.
 */
export async function verifyLoginOtp(identifier: string, code: string): Promise<LoginOtpResult> {
  const body = await request<{ success: boolean; data: unknown }>(
    "/api/v1/auth/verify-otp",
    { method: "POST", body: JSON.stringify({ identifier, code, purpose: "login" }) }
  );
  const obj = (body.data ?? {}) as Record<string, unknown>;
  if (typeof obj.preAuthToken === "string") {
    return {
      status: "two_factor_required",
      preAuthToken: obj.preAuthToken,
      methods: Array.isArray(obj.methods) ? (obj.methods as string[]) : [],
      defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
    };
  }
  await saveTokens(obj.accessToken as string, obj.refreshToken as string);
  return { status: "authenticated" };
}

export type OtpTwoFactorMethod = "EMAIL" | "SMS";

/**
 * Picks an emailed/SMS 2FA method from the account's available methods. The login step does
 * NOT send a code for 2FA-enabled accounts — the caller must dispatch one for EMAIL/SMS. Returns
 * null when the account only supports non-code methods (APP/TOTP/PASSKEY): TOTP has its own
 * authenticator step, and APP/PASSKEY are handled via the AZA App (QR) tab.
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

/**
 * Completes a 2FA login with a 6-digit authenticator (TOTP) code and stores the returned tokens.
 * Used when the account's only code-based factor is an authenticator app.
 */
export async function verifyTotpLogin(
  preAuthToken: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const body = await request<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/2fa/login",
    { method: "POST", body: JSON.stringify({ preAuthToken, code }) }
  );
  await saveTokens(body.data.accessToken, body.data.refreshToken);
  return body.data;
}

// ─── Forgot / reset password ─────────────────────────────────────────────────

/**
 * Sends a password-reset code to the account's email/phone. The backend answers 200 even when
 * no account matches — never surface a different message per outcome, that leaks which
 * identifiers are registered. Throws only on rate limiting (3 per 10 min) or transport errors.
 */
export async function forgotPassword(identifier: string): Promise<void> {
  await request("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

/** Completes the reset with the emailed/SMS code. All existing sessions are revoked server-side. */
export async function resetPassword(
  identifier: string,
  code: string,
  newPassword: string
): Promise<void> {
  await request("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ identifier, code, newPassword }),
  });
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

// ─── OAuth clients ("Sign in with AZA") ──────────────────────────────────────

export async function getOAuthClients(): Promise<OAuthClient[]> {
  const body = await request<{ success: boolean; data: OAuthClient[] }>("/api/v1/developer/clients");
  return body.data;
}

export async function createOAuthClient(data: {
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  websiteUrl?: string;
  redirectUris: string[];
  scopes: string[];
}): Promise<OAuthClient> {
  const body = await request<{ success: boolean; data: OAuthClient }>(
    "/api/v1/developer/clients",
    { method: "POST", body: JSON.stringify(data) }
  );
  return body.data;
}

export async function rotateOAuthClientSecret(clientId: string): Promise<OAuthClient> {
  const body = await request<{ success: boolean; data: OAuthClient }>(
    `/api/v1/developer/clients/${clientId}/rotate-secret`,
    { method: "POST" }
  );
  return body.data;
}

export async function deleteOAuthClient(clientId: string): Promise<void> {
  await request(`/api/v1/developer/clients/${clientId}`, { method: "DELETE" });
}

/** Attach the caller's merchant account so this client can use the `payment` scope. */
export async function linkOAuthClientMerchant(clientId: string): Promise<OAuthClient> {
  const body = await request<{ success: boolean; data: OAuthClient }>(
    `/api/v1/developer/clients/${clientId}/merchant`,
    { method: "POST" }
  );
  return body.data;
}

export async function unlinkOAuthClientMerchant(clientId: string): Promise<OAuthClient> {
  const body = await request<{ success: boolean; data: OAuthClient }>(
    `/api/v1/developer/clients/${clientId}/merchant`,
    { method: "DELETE" }
  );
  return body.data;
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

export async function regenerateWebhookSecret(id: string): Promise<WebhookEndpoint> {
  const body = await request<{ success: boolean; data: {
    id: string; url: string; signingSecret?: string; isActive: boolean; events: string; createdAt: string;
  } }>(`/api/v1/merchant/webhooks/${id}/regenerate-secret`, { method: "POST" });
  return { ...body.data, events: parseWebhookEvents(body.data.events) };
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

// ─── Send Money (personal wallet P2P transfer) ──────────────────────────────
// Moves funds out of your own AZA wallet (the account you're logged in as), not the
// business balance — that's what /merchant/payouts and Connect transfers are for.

export interface PersonalWallet {
  balance: number;
  currency: string;
  lastUpdatedAt: string | null;
}

export function getPersonalWallet(): Promise<PersonalWallet> {
  return request<{ success: boolean; data: PersonalWallet }>("/api/v1/wallet/balance").then((b) => b.data);
}

export interface TransferResult {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  currency: string;
  note: string | null;
  type: string;
  status: string;
  direction: "INCOMING" | "OUTGOING";
  initiatedAt: string;
  completedAt: string | null;
}

/** Creates a PENDING transfer and resolves the recipient's name — no funds move yet. */
export function initiateTransfer(data: {
  recipientIdentifier: string;
  amount: number;
  note?: string;
  idempotencyKey: string;
}): Promise<TransferResult> {
  return request<{ success: boolean; data: TransferResult }>("/api/v1/transfers", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((b) => b.data);
}

/** Debits your wallet and credits the recipient. Fails if the passcode is wrong or the transfer expired (10 min). */
export function confirmTransfer(id: string, passcode: string): Promise<TransferResult> {
  return request<{ success: boolean; data: TransferResult }>(`/api/v1/transfers/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ passcode }),
  }).then((b) => b.data);
}

export function getSentTransfers(page = 0, size = 10): Promise<Page<TransferResult>> {
  const params = new URLSearchParams({ direction: "OUTGOING", status: "COMPLETED", page: String(page), size: String(size) });
  return request<{ success: boolean; data: Page<TransferResult> }>(`/api/v1/transfers?${params}`).then((b) => b.data);
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

// ─── Connect (marketplace payouts) ────────────────────────────────────────────

export interface ConnectTransfer {
  id: string;
  recipient: string;
  recipientUserId: string | null;
  amount: number;
  currency: string;
  note: string | null;
  reference: string | null;
  status: "SIMULATED" | "PENDING" | "COMPLETED" | "FAILED";
  failureReason: string | null;
  testMode: boolean;
  createdAt: string;
  processedAt: string | null;
}

export interface ConnectBalance {
  available: number;
  currency: string;
}

export interface ConnectRecipient {
  found: boolean;
  canReceive: boolean;
  userId: string | null;
  displayName: string | null;
  reason: string | null;
}

export async function getConnectBalance(): Promise<ConnectBalance> {
  const body = await request<{ success: boolean; data: ConnectBalance }>(
    "/api/v1/merchant/connect/balance"
  );
  return body.data;
}

export async function resolveConnectRecipient(identifier: string): Promise<ConnectRecipient> {
  const body = await request<{ success: boolean; data: ConnectRecipient }>(
    `/api/v1/merchant/connect/recipients/resolve?identifier=${encodeURIComponent(identifier)}`
  );
  return body.data;
}

export async function getConnectTransfers(page = 0, size = 20): Promise<Page<ConnectTransfer>> {
  const body = await request<{ success: boolean; data: Page<ConnectTransfer> }>(
    `/api/v1/merchant/connect/transfers?page=${page}&size=${size}`
  );
  return body.data;
}

export async function createConnectTransfer(data: {
  recipient: string;
  amount: number;
  note?: string;
  reference?: string;
  idempotencyKey?: string;
}): Promise<ConnectTransfer> {
  const body = await request<{ success: boolean; data: ConnectTransfer }>(
    "/api/v1/merchant/connect/transfers",
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

// ─── Mini apps ───────────────────────────────────────────────────────────────
//
// These hit /api/v1/dev/miniapps, which authenticates a normal AZA user rather than a
// merchant — and this portal already logs in through /api/v1/auth/login, so the access
// token in memory is exactly what those endpoints expect. No separate developer account.

export type MiniAppStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED";
export type MiniAppHosting = "AZA_HOSTED" | "EXTERNAL";

export interface MiniApp {
  id: string;
  name: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  url?: string;
  developerName?: string;
  supportUrl?: string;
  version?: string;
  status: MiniAppStatus;
  requestedPermissions?: string[];
  rejectionReason?: string;
  hostingMode?: MiniAppHosting;
  bundleVersion?: string;
  pendingBundleVersion?: string;
  bundleSizeBytes?: number;
  bundleUploadedAt?: string;
  previewUrl?: string;
  createdAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface SaveMiniAppInput {
  id: string;
  name: string;
  description?: string;
  category: string;
  iconUrl?: string;
  hostingMode: MiniAppHosting;
  /** Required for EXTERNAL only — AZA_HOSTED apps get their URL assigned by the backend. */
  url?: string;
  developerName: string;
  supportUrl?: string;
  version?: string;
  requestedPermissions: string[];
  submitForReview: boolean;
}

export const MINI_APP_CATEGORIES = [
  "Finance", "Bills & Utilities", "Entertainment", "Shopping",
  "Transport", "Business", "Productivity", "Games",
] as const;

export const MINI_APP_PERMISSIONS: { id: string; label: string; help: string }[] = [
  { id: "USER_PROFILE",      label: "Profile",             help: "First name, username and avatar" },
  { id: "USER_PHONE",        label: "Phone number",        help: "Only if you need to contact the user" },
  { id: "USER_EMAIL",        label: "Email address",       help: "Only if you need to contact the user" },
  { id: "MAKE_PAYMENTS",     label: "Take payments",       help: "Charge the user with their confirmation" },
  { id: "READ_BALANCE",      label: "Read wallet balance", help: "Show what the user can afford" },
  { id: "READ_TRANSACTIONS", label: "Read transactions",   help: "Recent history — rarely approved" },
  { id: "DIRECT_DEBIT",      label: "Standing mandate",    help: "Recurring charges the user pre-approves" },
];

/** Matches spring.servlet.multipart.max-file-size, so we fail before wasting the upload. */
export const MINI_APP_MAX_BUNDLE_BYTES = 25 * 1024 * 1024;

export async function getMyMiniApps(): Promise<MiniApp[]> {
  const body = await request<{ data: MiniApp[] }>("/api/v1/dev/miniapps");
  return body.data ?? [];
}

export async function saveMiniApp(input: SaveMiniAppInput): Promise<MiniApp> {
  const body = await request<{ data: MiniApp }>("/api/v1/dev/miniapps", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function resubmitMiniApp(appId: string): Promise<MiniApp> {
  const body = await request<{ data: MiniApp }>(`/api/v1/dev/miniapps/${appId}/resubmit`, {
    method: "POST",
  });
  return body.data;
}

/**
 * Uploads a zipped static build. Staged for review — it does not replace whatever is
 * already live until a reviewer approves it, so this is safe to call against a live app.
 *
 * Uses XHR rather than the shared `request()` helper for two reasons: fetch still has no
 * upload-progress event, and `request()` forces Content-Type: application/json, which would
 * stop the browser generating the multipart boundary.
 */
export async function uploadMiniAppBundle(
  appId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MiniApp> {
  await ensureSession();

  const send = (token: string | null) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener("load", () => resolve({ status: xhr.status, text: xhr.responseText }));
      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

      xhr.open("POST", `${BASE_URL}/api/v1/dev/miniapps/${appId}/bundle`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      // Deliberately no Content-Type header — the browser has to set the multipart boundary.
      xhr.send(form);
    });

  let res = await send(getToken());
  // Mirror request()'s single retry: a bundle upload can outlive a ~15-minute access token.
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await send(getToken());
  }

  let parsed: { success?: boolean; data?: MiniApp; message?: string; error?: { message?: string } } | null = null;
  try { parsed = JSON.parse(res.text); } catch { /* nginx/proxy error page, not JSON */ }

  if (res.status >= 200 && res.status < 300 && parsed?.data) return parsed.data;

  throw new Error(
    parsed?.error?.message
    ?? parsed?.message
    ?? (res.status === 413
          ? "That bundle is too large for the server to accept."
          : `Upload failed (${res.status})`),
  );
}
