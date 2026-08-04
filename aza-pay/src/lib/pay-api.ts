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
  /**
   * "MANUAL" means this payment is held rather than paid out immediately, and the business
   * decides when it is released. The payer has to be told that before they approve — AZA
   * cannot later rule on whether a release was deserved, because it cannot see what the
   * payment was for.
   */
  release?: "AUTOMATIC" | "MANUAL";
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  successUrl: string | null;
}

/** Tokens returned once every factor has been satisfied. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export type TwoFaMode = "totp" | "sms" | "email";

/**
 * The three shapes POST /api/v1/auth/login can answer with. Which one comes back depends on the
 * account, not on the client: only staff/admin accounts (and the developer portal) are sent a
 * login OTP. An ordinary payer is logged in outright, and a 2FA payer gets a preAuthToken with
 * no code dispatched. Callers must branch on this instead of assuming an OTP is on its way.
 */
export type PreLoginResult =
  | { status: "authenticated"; accessToken: string; refreshToken: string }
  | { status: "otp_required" }
  | {
      status: "two_factor_required";
      preAuthToken: string;
      methods: string[];
      defaultMethod: string | null;
    };

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

function parseLoginResponse(data: unknown): PreLoginResult {
  // Accounts that are sent an emailed/SMS login OTP: the backend returns a plain string.
  if (typeof data === "string") return { status: "otp_required" };

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // No second factor — tokens are issued straight away and the login is already complete.
    if (typeof obj.accessToken === "string" && typeof obj.refreshToken === "string") {
      return {
        status: "authenticated",
        accessToken: obj.accessToken,
        refreshToken: obj.refreshToken,
      };
    }
    // 2FA account. No code has gone out yet: the caller picks a method and dispatches one.
    if (typeof obj.preAuthToken === "string") {
      return {
        status: "two_factor_required",
        preAuthToken: obj.preAuthToken,
        methods: Array.isArray(obj.methods) ? (obj.methods as string[]) : [],
        defaultMethod: typeof obj.defaultMethod === "string" ? obj.defaultMethod : null,
      };
    }
  }

  // Deliberately not defaulting to "wait for an OTP": nothing was sent, so that would leave the
  // payer on a code-entry screen forever. Fail loudly instead.
  throw new Error("Unexpected sign-in response from AZA. Please try again.");
}

export async function loginStep1(identifier: string, password: string): Promise<PreLoginResult> {
  const data = await post<unknown>("/api/v1/auth/login", {
    identifier,
    password,
    deviceName: "AZA Pay",
    deviceOs: "Web",
  });
  return parseLoginResponse(data);
}

/** Verifies a login OTP. Returns tokens, or a preAuthToken when the account also has 2FA. */
export async function loginStep2(identifier: string, code: string): Promise<PreLoginResult> {
  const data = await post<unknown>("/api/v1/auth/verify-otp", {
    identifier,
    code,
    purpose: "login",
    deviceName: "AZA Pay",
    deviceOs: "Web",
  });
  return parseLoginResponse(data);
}

/**
 * Picks the 2FA method to show first. The account's own default wins, so a payer who chose SMS
 * gets SMS even though TOTP would save a round-trip; only when the default is unusable do we
 * fall through to TOTP (needs no dispatch) and then the code-based factors. Returns null for
 * accounts offering only APP/PASSKEY, which this page can't drive — those payers approve from
 * the AZA app via the QR tab instead.
 */
export function pick2faMode(methods: string[], defaultMethod: string | null): TwoFaMode | null {
  if (defaultMethod === "TOTP" && methods.includes("TOTP")) return "totp";
  if (defaultMethod === "SMS" && methods.includes("SMS")) return "sms";
  if (defaultMethod === "EMAIL" && methods.includes("EMAIL")) return "email";
  if (methods.includes("TOTP")) return "totp";
  if (methods.includes("SMS")) return "sms";
  if (methods.includes("EMAIL")) return "email";
  return null;
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

// ── Receipt email ─────────────────────────────────────────────────────────────

export function sendEmailReceipt(sessionId: string, email: string): Promise<void> {
  return post(`/api/v1/checkout/${sessionId}/receipt/email`, { email });
}

// ── Payment mandates (direct debit) ─────────────────────────────────────────
// Hosted approval for a mandate an OAuth ("Sign in with AZA") app requested via
// POST /oauth/mandates — this page is the approvalUrl that response points to.

export interface MandateInfo {
  id: string;
  merchantId: string;
  merchantName: string | null;
  merchantLogoUrl: string | null;
  perChargeLimit: number;
  periodLimit: number | null;
  periodType: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  reference: string | null;
  status: "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
  sourceType: "MINI_APP" | "OAUTH";
  sourceId: string;
}

export function getMandate(mandateId: string): Promise<MandateInfo> {
  return get(`/api/v1/mandates/${mandateId}/public`);
}

export function confirmMandate(mandateId: string, passcode: string, token: string): Promise<MandateInfo> {
  return post(`/api/v1/mandates/${mandateId}/confirm`, { passcode }, token);
}
