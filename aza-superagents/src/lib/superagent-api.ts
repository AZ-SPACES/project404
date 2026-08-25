/**
 * Client for the super-agent portal.
 *
 * Every call goes to a same-origin route under /api — never to the API host. The session lives
 * in httpOnly cookies the browser attaches automatically, so there is no token to hold, refresh
 * or accidentally log here. If a call comes back 401 the session is genuinely gone and the only
 * thing to do is send the user back to the sign-in page.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SuperAgentStatus = "NONE" | "NOT_SUPER" | "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface SuperAgentMe {
  status: SuperAgentStatus;
  tier: string | null;
  code: string | null;
  businessName: string | null;
  userName: string | null;
  floatBalance: number | null;
  floatLimit: number | null;
  subAgentCount: number;
  currency: string;
}

export interface SuperAgentSummary {
  floatBalance: number;
  downlineFloat: number;
  distributedToday: number;
  distributedSevenDays: number;
  distributedThirtyDays: number;
  recalledThirtyDays: number;
  subAgentsTotal: number;
  subAgentsActive: number;
  subAgentsPending: number;
  subAgentsSuspended: number;
  downlineCommissionAccrued: number;
  currency: string;
}

export type Direction = "DISTRIBUTE" | "RECALL";

export interface FloatDistribution {
  id: string;
  direction: Direction;
  amount: number;
  currency: string;
  subAgentId: string;
  subAgentCode: string | null;
  subAgentName: string | null;
  note: string | null;
  transactionId: string | null;
  /**
   * Only present on the movement you just made. Ledger rows leave these null — they would be
   * the balances now rather than as at the movement, which is a different number.
   */
  superAgentFloatBalance: number | null;
  subAgentFloatBalance: number | null;
  createdAt: string | null;
}

export type AgentStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface SubAgent {
  id: string;
  userId: string;
  code: string | null;
  status: AgentStatus;
  userName: string | null;
  userPhone: string | null;
  location: string | null;
  businessName: string | null;
  floatBalance: number;
  floatLimit: number | null;
  commissionAccruedGhs: number;
  netFloatReceived: number;
  createdAt: string | null;
}

export interface ReconciliationRow {
  subAgentId: string;
  code: string | null;
  userName: string | null;
  status: AgentStatus;
  heldFloat: number;
  netDistributed: number;
  variance: number;
}

export interface Reconciliation {
  masterFloat: number;
  downlineFloat: number;
  netDistributed: number;
  variance: number;
  currency: string;
  rows: ReconciliationRow[];
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/** Thrown for any non-2xx answer, carrying the backend's own message where there is one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Envelope<T> = { success?: boolean; data?: T; message?: string; error?: { message?: string; code?: string } };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/sa${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(
      body?.message ?? body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.code
    );
  }

  return (body?.data ?? body) as T;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type LoginResult =
  | { status: "authenticated" }
  | { status: "otp_required" }
  | { status: "two_factor_required"; methods: string[]; defaultMethod: string | null };

async function auth<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.message ?? "Something went wrong", res.status);
  }
  return body as T;
}

export const login = (identifier: string, password: string) =>
  auth<LoginResult>("login", { identifier, password });

export const verifyLoginOtp = (identifier: string, code: string) =>
  auth<LoginResult>("otp", { identifier, code });

export const sendTwoFactorCode = (method: "EMAIL" | "SMS") =>
  auth<{ status: "sent" }>("two-factor", { method });

export const verifyTwoFactor = (code: string, method: string | null) =>
  auth<LoginResult>("two-factor", { code, method });

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
}

/**
 * Picks the code-based factor to show. TOTP/APP/PASSKEY have no code to dispatch, so an
 * account whose only factors are those falls through to the authenticator input.
 */
export function pickTwoFactorMethod(methods: string[], defaultMethod: string | null): "EMAIL" | "SMS" | null {
  if (defaultMethod === "EMAIL" || defaultMethod === "SMS") return defaultMethod;
  if (methods.includes("EMAIL")) return "EMAIL";
  if (methods.includes("SMS")) return "SMS";
  return null;
}

// ─── Super-agent surface ─────────────────────────────────────────────────────

export const getMe = () => call<SuperAgentMe>("/me");

export const getSummary = () => call<SuperAgentSummary>("/summary");

export const getSubAgents = (status?: AgentStatus) =>
  call<SubAgent[]>(`/sub-agents${status ? `?status=${status}` : ""}`);

export const getSubAgent = (id: string) => call<SubAgent>(`/sub-agents/${id}`);

export const inviteSubAgent = (payload: {
  identifier: string;
  businessName: string;
  location?: string;
  contactPhone?: string;
  idNumber?: string;
  expectedMonthlyVolumeGhs?: number;
  applicationNotes?: string;
}) => call<SubAgent>("/sub-agents/invite", { method: "POST", body: JSON.stringify(payload) });

export interface MoveFloatInput {
  subAgentCode?: string;
  subAgentId?: string;
  amount: number;
  note?: string;
  /** Required by the backend — a movement without one is refused, not retried silently. */
  idempotencyKey: string;
  /** The operator's 4-digit passcode, checked server-side before any balance changes. */
  passcode: string;
}

export const distributeFloat = (input: MoveFloatInput) =>
  call<FloatDistribution>("/distribute", { method: "POST", body: JSON.stringify(input) });

export const recallFloat = (input: MoveFloatInput) =>
  call<FloatDistribution>("/recall", { method: "POST", body: JSON.stringify(input) });

export const getDistributions = (params: {
  direction?: Direction;
  subAgentId?: string;
  page?: number;
  size?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (params.direction) qs.set("direction", params.direction);
  if (params.subAgentId) qs.set("subAgentId", params.subAgentId);
  qs.set("page", String(params.page ?? 0));
  qs.set("size", String(params.size ?? 20));
  return call<Page<FloatDistribution>>(`/distributions?${qs}`);
};

export const getReconciliation = () => call<Reconciliation>("/reconciliation");
