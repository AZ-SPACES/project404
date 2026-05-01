const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aza_admin_token");
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("aza_admin_token", accessToken);
  localStorage.setItem("aza_admin_refresh_token", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("aza_admin_token");
  localStorage.removeItem("aza_admin_refresh_token");
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

  if (res.status === 401 || res.status === 403) {
    clearTokens();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    role: string;
  };
}

/** Step 1: submit credentials → OTP is sent, returns nothing meaningful on success */
export async function adminLoginStep1(identifier: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Login failed");
}

/** Step 2: verify OTP → returns LoginResult or throws "TOTP_REQUIRED:<preAuthToken>" */
export async function adminLoginStep2(
  identifier: string,
  code: string,
  deviceName = "Admin Web",
  deviceOs = "Web"
): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, code, purpose: "login", deviceName, deviceOs }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "OTP verification failed");
  if (body.data?.preAuthToken) throw new Error("TOTP_REQUIRED:" + body.data.preAuthToken);
  return body.data as LoginResult;
}

/** Step 3 (optional): TOTP verification */
export async function adminLoginTotp(preAuthToken: string, code: string): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/2fa/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preAuthToken, code }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "TOTP failed");
  return body.data as LoginResult;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  deactivatedUsers: number;
  kycVerified: number;
  kycPendingReview: number;
  kycRejected: number;
  kycNotStarted: number;
  totalTransactions: number;
  completedTransactions: number;
  totalTransactionVolume: number;
  transactionsToday: number;
  volumeToday: number;
}

export function getStats(): Promise<AdminStats> {
  return request("/api/v1/admin/dashboard/stats");
}

// ── KYC ───────────────────────────────────────────────────────────────────────

export interface KycRecord {
  userId: string;
  displayName: string;
  email: string;
  status: string;
  completionPercentage: number;
  idType: string;
  idNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  fundsSource: string;
  isPep: boolean;
  rejectionReason: string | null;
  verificationProvider: string | null;
}

export function getPendingKyc(): Promise<KycRecord[]> {
  return request("/api/v1/admin/kyc/pending");
}

export function reviewKyc(userId: string, approve: boolean, reason: string): Promise<KycRecord> {
  return request(`/api/v1/admin/kyc/review/${userId}`, {
    method: "POST",
    body: JSON.stringify({ approve, reason }),
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  phone: string;
  handle: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  city: string | null;
  homeAddress: string | null;
  employmentStatus: string | null;
  accountStatus: string;
  kycStatus: string;
  role: string;
  twoFactorEnabled: boolean;
  biometricsEnabled: boolean;
  walletBalance: number;
  walletCurrency: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export function getUsers(params: {
  query?: string;
  status?: string;
  kycStatus?: string;
  page?: number;
  size?: number;
}): Promise<Page<AdminUser>> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.status) qs.set("status", params.status);
  if (params.kycStatus) qs.set("kycStatus", params.kycStatus);
  qs.set("page", String(params.page ?? 0));
  qs.set("size", String(params.size ?? 20));
  return request(`/api/v1/admin/users?${qs}`);
}

export function getUserDetail(userId: string): Promise<AdminUser> {
  return request(`/api/v1/admin/users/${userId}`);
}

export function updateUserStatus(
  userId: string,
  status: string,
  reason?: string
): Promise<AdminUser> {
  return request(`/api/v1/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}
