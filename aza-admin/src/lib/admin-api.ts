const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getToken(): string | null {
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
  localStorage.removeItem("aza_admin_user");
}

// ── Staff roles ───────────────────────────────────────────────────────────────

export type StaffRoleName = "ADMIN" | "SUPPORT" | "COMPLIANCE" | "FINANCE";

export function saveUser(user: LoginResult["user"]) {
  localStorage.setItem("aza_admin_user", JSON.stringify(user));
}

export function getStoredUser(): LoginResult["user"] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("aza_admin_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Roles the signed-in staff member holds. Empty when unknown (pre-existing session). */
export function getStoredRoles(): StaffRoleName[] {
  const user = getStoredUser();
  if (!user) return [];
  const roles = (user.staffRoles ?? []) as StaffRoleName[];
  if (user.role === "ADMIN" && !roles.includes("ADMIN")) roles.push("ADMIN");
  return roles;
}

export function isStaff(user: LoginResult["user"]): boolean {
  return user.role === "ADMIN" || (user.staffRoles?.length ?? 0) > 0;
}

/** ADMIN implies every other role, mirroring the backend's expansion. */
export function hasRole(roles: StaffRoleName[], required: StaffRoleName[]): boolean {
  if (roles.includes("ADMIN")) return true;
  return required.some((r) => roles.includes(r));
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.map((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
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
      const refreshToken = localStorage.getItem("aza_admin_refresh_token");
      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        throw new Error("No refresh token");
      }

      try {
        const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const refreshBody = await refreshRes.json();
        
        if (refreshRes.ok && refreshBody.success) {
          const { accessToken, refreshToken: newRefreshToken } = refreshBody.data;
          saveTokens(accessToken, newRefreshToken);
          isRefreshing = false;
          onTokenRefreshed(accessToken);
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
      addRefreshSubscriber((newToken) => {
        resolve(request(path, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        }));
      });
    });
  }

  if (res.status === 403) {
    // 403 is often "Forbidden" (wrong role) not just expired.
    // If it's truly a session issue, the backend should return 401.
    const errBody = await res.json().catch(() => null);
    if (errBody?.error?.code === "STEP_UP_REQUIRED") {
      // Admin elevation expired — re-verify, then come back here.
      if (window.location.pathname !== "/step-up") {
        window.location.href = `/step-up?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new Error("Verification required");
    }
    throw new Error(errBody?.error?.message ?? "Forbidden: You don't have permission for this action");
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
    staffRoles?: string[];
  };
}

export async function adminLoginStep1(identifier: string, password: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Login failed");
}

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

// ── QR Login ─────────────────────────────────────────────────────────────────

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
    body: JSON.stringify({ siteType: "ADMIN" }),
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

export async function completeQrLogin(challengeToken: string, sessionSecret: string): Promise<LoginResult> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/qr-login/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeToken, sessionSecret }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "QR login failed");
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
  totalMerchants: number;
  activeMerchants: number;
  pendingKybMerchants: number;
  totalMerchantVolume: number;
  totalWalletBalance: number;
  totalMerchantBalance: number;
}

export interface MerchantStats {
  total: number;
  active: number;
  pendingKyb: number;
  kybSubmitted: number;
  kybUnderReview: number;
  moreInfoRequired: number;
  suspended: number;
  rejected: number;
  totalBalance: number;
  totalVolume: number;
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

/** Approving goes through maker-checker once 2+ staff exist — may return a pending Approval. */
export function reviewKyc(userId: string, approve: boolean, reason: string): Promise<KycRecord | Approval> {
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
  username: string;
  firstName: string;
  lastName: string;
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
  onlineStatus: "ONLINE" | "OFFLINE";
  lastSeenAt: string | null;
  customDailyLimitGhs: number | null;
  customSingleTransactionLimitGhs: number | null;
}

export interface UserSession {
  id: string;
  deviceName: string | null;
  deviceOs: string | null;
  ipAddress: string | null;
  location: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  currentDevice: boolean;
  online: boolean;
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
  online?: boolean;
  page?: number;
  size?: number;
}): Promise<Page<AdminUser>> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.status) qs.set("status", params.status);
  if (params.kycStatus) qs.set("kycStatus", params.kycStatus);
  if (params.online) qs.set("online", "true");
  qs.set("page", String(params.page ?? 0));
  qs.set("size", String(params.size ?? 20));
  return request(`/api/v1/admin/users?${qs}`);
}

export function getUserDetail(userId: string): Promise<AdminUser> {
  return request(`/api/v1/admin/users/${userId}`);
}

export function getUserSessions(userId: string): Promise<UserSession[]> {
  return request(`/api/v1/admin/users/${userId}/sessions`);
}

export function revokeUserSession(userId: string, sessionId: string): Promise<string> {
  return request(`/api/v1/admin/users/${userId}/sessions/${sessionId}`, { method: "DELETE" });
}

/** Reactivation (status ACTIVE) goes through maker-checker — may return a pending Approval. */
export function updateUserStatus(userId: string, status: string, reason?: string): Promise<AdminUser | Approval> {
  return request(`/api/v1/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

/** Granting ADMIN goes through maker-checker once a second staff member exists. */
export function updateUserRole(userId: string, role: string): Promise<AdminUser | Approval> {
  return request(`/api/v1/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// ── Support ───────────────────────────────────────────────────────────────────

export interface SupportChatSummary {
  chatId: string;
  userId: string;
  userName: string;
  userHandle: string | null;
  userAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status: "OPEN" | "PENDING" | "RESOLVED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  category: string | null;
  unreadCount: number;
  botActive: boolean;
  activeAgentId: string | null;
}

export interface SupportMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  type: string;
  status: string;
  sentAt: string | null;
  isDeleted: boolean;
  isSelf?: boolean;
  isBot?: boolean;
}

export function getSupportChats(page = 0, size = 20, status?: string): Promise<Page<SupportChatSummary>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/support/chats?${params}`);
}

export function getSupportChat(chatId: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}`);
}

export function getSupportChatMessages(chatId: string, page = 0, size = 50): Promise<Page<SupportMessage>> {
  return request(`/api/v1/admin/support/chats/${chatId}/messages?page=${page}&size=${size}&_t=${Date.now()}`);
}

export function sendSupportReply(chatId: string, content: string): Promise<SupportMessage> {
  return request(`/api/v1/admin/support/chats/${chatId}/reply`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function sendTypingIndicator(chatId: string, isTyping: boolean): Promise<void> {
  return request(`/api/v1/chats/typing`, {
    method: "POST",
    body: JSON.stringify({ chatId, isTyping }),
  });
}

export function initiateCall(calleeId: string, type: "VOICE" | "VIDEO"): Promise<void> {
  return request("/api/v1/calls", {
    method: "POST",
    body: JSON.stringify({ calleeId, type }),
  });
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface AdminTransaction {
  id: string;
  senderId: string;
  senderName: string;
  senderHandle: string | null;
  recipientId: string;
  recipientName: string;
  recipientHandle: string | null;
  amount: number;
  note: string | null;
  type: string;
  status: string;
  initiatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  category: string | null;
  anomalyScore: number | null;
  anomalyRiskLevel: string | null;
}

export function getAdminTransactions(page = 0, size = 20): Promise<Page<AdminTransaction>> {
  return request(`/api/v1/admin/dashboard/transactions?page=${page}&size=${size}`);
}

export function searchAdminTransactions(params: {
  query?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}): Promise<Page<AdminTransaction>> {
  const qs = new URLSearchParams({ page: String(params.page ?? 0), size: String(params.size ?? 20) });
  if (params.query) qs.set("query", params.query);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return request(`/api/v1/admin/dashboard/transactions?${qs}`);
}

export function exportAdminTransactionsCsv(params: {
  status?: string; type?: string; from?: string; to?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return downloadFile(`/api/v1/admin/dashboard/transactions/export?${qs}`, "transactions.csv");
}

// ── Wallets ───────────────────────────────────────────────────────────────────

export interface AdminWallet {
  walletId: string;
  userId: string;
  userName: string;
  userHandle: string | null;
  userEmail: string;
  balance: number;
  currency: string;
  frozen: boolean;
  lastUpdatedAt: string | null;
}

export function getAdminWallets(page = 0, size = 20): Promise<Page<AdminWallet>> {
  return request(`/api/v1/admin/wallets?page=${page}&size=${size}`);
}

/** Unfreezing goes through maker-checker — may return a pending Approval. */
export function freezeWallet(userId: string, freeze: boolean): Promise<AdminWallet | Approval> {
  return request(`/api/v1/admin/wallets/${userId}/freeze`, {
    method: "POST",
    body: JSON.stringify({ freeze }),
  });
}

// ── KYC Analytics ─────────────────────────────────────────────────────────────

export interface KycAnalytics {
  notStarted: number;
  pending: number;
  underReview: number;
  verified: number;
  rejected: number;
  approvedLast30Days: number;
  rejectedLast30Days: number;
  submittedLast30Days: number;
  approvalRate: number;
}

export function getKycAnalytics(): Promise<KycAnalytics> {
  return request("/api/v1/admin/kyc/analytics");
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  action: string;
  targetUserId: string | null;
  targetUserEmail: string | null;
  details: string | null;
  timestamp: string;
}

export function getAuditLog(page = 0, size = 20, adminId?: string): Promise<Page<AuditLogEntry>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (adminId) params.set("adminId", adminId);
  return request(`/api/v1/admin/audit-log?${params}`);
}

// ── Broadcast Notifications ───────────────────────────────────────────────────

export interface BroadcastResult {
  sent: number;
}

export function broadcastNotification(
  title: string,
  body: string,
  audience: "ALL" | "KYC_VERIFIED" | "ACTIVE_ONLY",
  imageUrl?: string
): Promise<BroadcastResult> {
  return request("/api/v1/admin/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify({ title, body, audience, imageUrl }),
  });
}

// ── Transaction Detail ────────────────────────────────────────────────────────

export function getAdminTransaction(id: string): Promise<AdminTransaction> {
  return request(`/api/v1/admin/dashboard/transactions/${id}`);
}

// ── Live Stats ────────────────────────────────────────────────────────────────

export interface LiveStats {
  onlineUsers: number;
  transactionsLastHour: number;
  pendingKycCount: number;
}

export function getLiveStats(): Promise<LiveStats> {
  return request("/api/v1/admin/dashboard/live-stats");
}

// ── KYC record for any user (not just pending) ────────────────────────────────

export function getKycRecord(userId: string): Promise<KycRecord> {
  return request(`/api/v1/admin/kyc/user/${userId}`);
}

// ── User transactions ─────────────────────────────────────────────────────────

export function getUserTransactions(userId: string, page = 0, size = 10): Promise<Page<AdminTransaction>> {
  return request(`/api/v1/admin/users/${userId}/transactions?page=${page}&size=${size}`);
}

// ── User transaction limits ───────────────────────────────────────────────────

/** Maker-checker: returns the pending approval, not the (unchanged) user. */
export function updateUserLimits(
  userId: string,
  dailyLimitGhs: number | null,
  singleTransactionLimitGhs: number | null,
): Promise<Approval> {
  return request(`/api/v1/admin/users/${userId}/limits`, {
    method: "PATCH",
    body: JSON.stringify({ dailyLimitGhs, singleTransactionLimitGhs }),
  });
}

// ── Support management ────────────────────────────────────────────────────────

export interface SupportStats {
  open: number;
  resolved: number;
}

export function getSupportStats(): Promise<SupportStats> {
  return request("/api/v1/admin/support/stats");
}

export function takeoverChat(chatId: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/takeover`, { method: "POST" });
}

export function enableSupportBot(chatId: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/bot/enable`, { method: "POST" });
}

export function resolveChat(chatId: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/resolve`, { method: "POST" });
}

export function reopenChat(chatId: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/reopen`, { method: "POST" });
}

export function updateChatPriority(chatId: string, priority: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  });
}

// ── Transaction reversal ──────────────────────────────────────────────────────

/** Maker-checker: returns the pending approval; the reversal runs once approved. */
export function reverseTransaction(txId: string): Promise<Approval> {
  return request(`/api/v1/admin/dashboard/transactions/${txId}/reverse`, { method: "POST" });
}

// ── Internal Notes ────────────────────────────────────────────────────────────

export interface InternalNote {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function getInternalNotes(chatId: string): Promise<InternalNote[]> {
  return request(`/api/v1/admin/support/chats/${chatId}/notes`);
}

export function addInternalNote(chatId: string, content: string): Promise<InternalNote> {
  return request(`/api/v1/admin/support/chats/${chatId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ── Canned Responses ──────────────────────────────────────────────────────────

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  usageCount: number;
  createdAt?: string;
}

export function getCannedResponses(): Promise<CannedResponse[]> {
  return request("/api/v1/admin/support/canned-responses");
}

export function createCannedResponse(data: { title: string; content: string; category: string }): Promise<CannedResponse> {
  return request("/api/v1/admin/support/canned-responses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteCannedResponse(id: string): Promise<void> {
  return request(`/api/v1/admin/support/canned-responses/${id}`, { method: "DELETE" });
}

// ── Update chat category ──────────────────────────────────────────────────────

export function updateChatCategory(chatId: string, category: string): Promise<SupportChatSummary> {
  return request(`/api/v1/admin/support/chats/${chatId}/category`, {
    method: "PATCH",
    body: JSON.stringify({ category }),
  });
}

// ── Support Analytics ─────────────────────────────────────────────────────────

export interface SupportAnalytics {
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number;
  avgResolutionHours: number;
  slaComplianceRate: number;
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  recentTrend: { date: string; opened: number; resolved: number }[];
}

export function getSupportAnalytics(): Promise<SupportAnalytics> {
  return request("/api/v1/admin/support/analytics");
}

// ── Compliance / AML ──────────────────────────────────────────────────────────

export interface FlaggedTransaction {
  id: string;
  transactionId: string;
  userId: string;
  userName: string;
  userHandle: string | null;
  amount: number;
  currency: string;
  flagReason: string;
  riskScore: number;
  status: "PENDING_REVIEW" | "CLEARED" | "REPORTED";
  flaggedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export interface ComplianceStats {
  flaggedToday: number;
  pendingReview: number;
  clearedThisMonth: number;
  reportsFiledThisMonth: number;
  highRiskUsers: number;
  averageRiskScore: number;
}

export function getFlaggedTransactions(page = 0, size = 20, status?: string): Promise<Page<FlaggedTransaction>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/compliance/flagged?${params}`);
}

export function getComplianceStats(): Promise<ComplianceStats> {
  return request("/api/v1/admin/compliance/stats");
}

export function reviewFlaggedTransaction(id: string, action: "CLEAR" | "REPORT", notes: string): Promise<FlaggedTransaction> {
  return request(`/api/v1/admin/compliance/flagged/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, notes }),
  });
}

export function exportAmlRegisterCsv(params: { status?: string; from?: string; to?: string }): Promise<void> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return downloadFile(`/api/v1/admin/compliance/flagged/export?${qs}`, "aml-register.csv");
}

// ── Disputes ──────────────────────────────────────────────────────────────────

export interface Dispute {
  id: string;
  referenceId: string;
  transactionId: string;
  userId: string;
  userName: string;
  userHandle: string | null;
  amount: number;
  currency: string;
  category: "UNAUTHORIZED" | "WRONG_AMOUNT" | "NOT_RECEIVED" | "DUPLICATE" | "SERVICE_ISSUE" | "OTHER";
  description: string;
  evidence: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_APPROVED" | "RESOLVED_DENIED";
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DisputeStats {
  open: number;
  underReview: number;
  resolvedThisMonth: number;
  totalValueDisputed: number;
}

export function getDisputes(page = 0, size = 20, status?: string): Promise<Page<Dispute>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/disputes?${params}`);
}

export function getDisputeStats(): Promise<DisputeStats> {
  return request("/api/v1/admin/disputes/stats");
}

export function resolveDispute(id: string, action: "APPROVE" | "DENY", resolution: string): Promise<Dispute> {
  return request(`/api/v1/admin/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, resolution }),
  });
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface PlatformReport {
  period: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  feeRevenue: number;
  transactionVolume: number;
  transactionCount: number;
  newUsers: number;
  activeUsers: number;
  kycVerifications: number;
  averageTransactionSize: number;
  topTransactionType: string;
}

export function getPlatformReport(period: "TODAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR"): Promise<PlatformReport> {
  return request(`/api/v1/admin/reports/summary?period=${period}`);
}

// ── Risk Management ───────────────────────────────────────────────────────────

export interface RiskAlert {
  id: string;
  userId: string;
  userName: string;
  userHandle: string | null;
  alertType: "VELOCITY" | "LARGE_TRANSFER" | "UNUSUAL_PATTERN" | "MULTIPLE_DEVICES" | "BLACKLIST_MATCH" | "PEP_MATCH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  transactionId: string | null;
  riskScore: number;
  triggeredAt: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "FALSE_POSITIVE";
  notes: string | null;
}

export interface RiskStats {
  openAlerts: number;
  criticalAlerts: number;
  investigatingAlerts: number;
  resolvedToday: number;
  averageRiskScore: number;
}

export function getRiskAlerts(page = 0, size = 20, severity?: string, status?: string): Promise<Page<RiskAlert>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (severity) params.set("severity", severity);
  if (status) params.set("status", status);
  return request(`/api/v1/admin/risk/alerts?${params}`);
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export function sendCampaign(data: {
  type: string;
  segment: string;
  subject?: string;
  message: string;
}): Promise<{ message: string }> {
  return request("/api/v1/admin/campaigns/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getRiskStats(): Promise<RiskStats> {
  return request("/api/v1/admin/risk/stats");
}

export function updateRiskAlert(id: string, status: string, notes?: string): Promise<RiskAlert> {
  return request(`/api/v1/admin/risk/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

// ── System Settings ───────────────────────────────────────────────────────────

export interface SystemSettings {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  kycRequired: boolean;
  maxDailyTransferGhs: number;
  maxSingleTransactionGhs: number;
  supportEmail: string;
  supportPhone: string;
  platformVersion: string;
  blockedCountries: string[];
  featureFlags: {
    biometricEnabled: boolean;
    p2pEnabled: boolean;
    notificationsEnabled: boolean;
  };
}

export function getSystemSettings(): Promise<SystemSettings> {
  return request("/api/v1/admin/settings");
}

/** Maker-checker once a second staff member exists: may return a pending Approval instead. */
export function updateSystemSettings(
  settings: Partial<Omit<SystemSettings, "platformVersion">>,
): Promise<SystemSettings | Approval> {
  return request("/api/v1/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

// ── Fee Management ────────────────────────────────────────────────────────────

export interface FeeRule {
  id: string;
  name: string;
  description: string;
  transactionType: string;
  feeType: "FLAT" | "PERCENTAGE";
  amount: number;
  minFee: number | null;
  maxFee: number | null;
  tierMinAmount: number | null;
  tierMaxAmount: number | null;
  active: boolean;
  effectiveFrom: string;
}

export interface FeeStats {
  totalFeeRevenueToday: number;
  totalFeeRevenueMonth: number;
  averageFeePerTransaction: number;
  activeFeeRules: number;
}

export function getFeeRules(): Promise<FeeRule[]> {
  return request("/api/v1/admin/fees");
}

export function getFeeStats(): Promise<FeeStats> {
  return request("/api/v1/admin/fees/stats");
}

/** Maker-checker: returns the pending approval; the rule changes once approved. */
export function updateFeeRule(id: string, data: Partial<Pick<FeeRule, "amount" | "active" | "minFee" | "maxFee">>): Promise<Approval> {
  return request(`/api/v1/admin/fees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Support Agents ────────────────────────────────────────────────────────────

export interface AgentStatus {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export function getAvailableAgents(): Promise<AgentStatus[]> {
  return request("/api/v1/admin/support/agents/available");
}

// ── Merchants ─────────────────────────────────────────────────────────────────

export function getMerchantStats(): Promise<MerchantStats> {
  return request("/api/v1/admin/merchants/stats");
}

export function getKybQueue(page = 0, size = 50): Promise<Page<AdminMerchant>> {
  return request(`/api/v1/admin/merchants/kyb-queue?page=${page}&size=${size}`);
}

export interface AdminMerchant {
  id: string;
  userId: string;
  businessName: string;
  businessHandle: string;
  businessEmail: string | null;
  businessPhone: string | null;
  businessDescription: string | null;
  logoUrl: string | null;
  category: string | null;
  status: string;
  rejectionReason: string | null;
  moreInfoRequest: string | null;
  balance: number;
  currency: string;
  totalVolume: number;
  feeRateBps: number;
  createdAt: string;
  activatedAt: string | null;
  activeApiKeyCount: number | null;
  activeWebhookCount: number | null;
}

export interface KybDocument {
  id: string;
  type: string;
  fileName: string | null;
  url: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string | null;
}

export interface MerchantKyb {
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

export interface MerchantPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  requestedAt: string | null;
  completedAt: string | null;
}

export interface MerchantSession {
  id: string;
  merchantId: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  customerId: string | null;
  platformFee: number | null;
  netAmount: number | null;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

export function getMerchants(params: {
  query?: string;
  status?: string;
  page?: number;
  size?: number;
}): Promise<Page<AdminMerchant>> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page ?? 0));
  qs.set("size", String(params.size ?? 20));
  return request(`/api/v1/admin/merchants?${qs}`);
}

export function getMerchantById(merchantId: string): Promise<AdminMerchant> {
  return request(`/api/v1/admin/merchants/${merchantId}`);
}

export function getMerchantKyb(merchantId: string): Promise<MerchantKyb> {
  return request(`/api/v1/admin/merchants/${merchantId}/kyb`);
}

export function reviewMerchantKyb(
  merchantId: string,
  approve: boolean,
  rejectionReason?: string,
  moreInfoRequest?: string
): Promise<MerchantKyb> {
  return request(`/api/v1/admin/merchants/${merchantId}/kyb/review`, {
    method: "POST",
    body: JSON.stringify({ approve, rejectionReason, moreInfoRequest }),
  });
}

export function setMerchantStatus(merchantId: string, status: string): Promise<AdminMerchant> {
  return request(`/api/v1/admin/merchants/${merchantId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function updateMerchantFeeRate(merchantId: string, feeRateBps: number): Promise<AdminMerchant> {
  return request(`/api/v1/admin/merchants/${merchantId}/fee-rate`, {
    method: "PATCH",
    body: JSON.stringify({ feeRateBps }),
  });
}

export function getMerchantPayouts(merchantId: string, page = 0, size = 20): Promise<Page<MerchantPayout>> {
  return request(`/api/v1/admin/merchants/${merchantId}/payouts?page=${page}&size=${size}`);
}

export function getMerchantSessions(merchantId: string, page = 0, size = 20): Promise<Page<MerchantSession>> {
  return request(`/api/v1/admin/merchants/${merchantId}/sessions?page=${page}&size=${size}`);
}

// ── Merchant Invoices (admin view) ────────────────────────────────────────────

export interface MerchantInvoice {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
}

export function getMerchantInvoices(merchantId: string, page = 0, size = 20): Promise<Page<MerchantInvoice>> {
  return request(`/api/v1/admin/merchants/${merchantId}/invoices?page=${page}&size=${size}`);
}

// ── Merchant Settlements (admin view) ─────────────────────────────────────────

export interface MerchantSettlement {
  id: string;
  grossAmount: number;
  feeTotal: number;
  netAmount: number;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  createdAt: string;
  settledAt: string | null;
}

export function getMerchantSettlements(merchantId: string, page = 0, size = 20): Promise<Page<MerchantSettlement>> {
  return request(`/api/v1/admin/merchants/${merchantId}/settlements?page=${page}&size=${size}`);
}

// ── Merchant Customers (admin view) ──────────────────────────────────────────

export interface MerchantCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalPayments: number;
  totalSpend: number;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
}

export function getMerchantCustomers(merchantId: string, page = 0, size = 20): Promise<Page<MerchantCustomer>> {
  return request(`/api/v1/admin/merchants/${merchantId}/customers?page=${page}&size=${size}`);
}

// ── Merchant Disputes (admin view, per merchant) ──────────────────────────────

export function getMerchantDisputesByMerchant(merchantId: string, page = 0, size = 20): Promise<Page<Dispute>> {
  return request(`/api/v1/admin/merchants/${merchantId}/disputes?page=${page}&size=${size}`);
}

// ── Merchant Bulk Transfers (admin view) ──────────────────────────────────────

export interface MerchantBulkTransfer {
  id: string;
  note: string | null;
  totalAmount: number;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

export function getMerchantBulkTransfers(merchantId: string, page = 0, size = 20): Promise<Page<MerchantBulkTransfer>> {
  return request(`/api/v1/admin/merchants/${merchantId}/bulk-transfers?page=${page}&size=${size}`);
}

// ── Merchant Audit Log (admin view) ──────────────────────────────────────────

export interface MerchantAuditLogEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function getMerchantAuditLogByMerchant(merchantId: string, page = 0, size = 30): Promise<Page<MerchantAuditLogEntry>> {
  return request(`/api/v1/admin/merchants/${merchantId}/audit-logs?page=${page}&size=${size}`);
}

// ── Rate Limit Management ─────────────────────────────────────────────────────

export function resetUserRateLimit(userId: string): Promise<string> {
  return request(`/api/v1/admin/risk/rate-limits/user/${userId}`, { method: "DELETE" });
}

export function resetIpRateLimit(ip: string): Promise<string> {
  return request(`/api/v1/admin/risk/rate-limits/ip?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
}

export function resetAllRateLimits(): Promise<{ keysDeleted: number }> {
  return request("/api/v1/admin/risk/rate-limits", { method: "DELETE" });
}

export function getRateLimitStats(): Promise<{ activeKeys: number }> {
  return request("/api/v1/admin/risk/rate-limits/stats");
}

// ── Limit Increase Requests ───────────────────────────────────────────────────

export interface LimitRequest {
  id: string;
  userId: string;
  currentDailyLimitGhs: number;
  currentSingleTransactionLimitGhs: number;
  requestedDailyLimitGhs: number;
  requestedSingleTransactionLimitGhs: number;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface LimitRequestStats {
  pending: number;
  approved: number;
  denied: number;
}

export function getLimitRequests(page = 0, size = 20, status?: string): Promise<Page<LimitRequest>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/limit-requests?${params}`);
}

export function getLimitRequestStats(): Promise<LimitRequestStats> {
  return request("/api/v1/admin/limit-requests/stats");
}

export function approveLimitRequest(id: string, notes: string): Promise<LimitRequest> {
  return request(`/api/v1/admin/limit-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function denyLimitRequest(id: string, notes: string): Promise<LimitRequest> {
  return request(`/api/v1/admin/limit-requests/${id}/deny`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

// ── Analytics: Cohorts ───────────────────────────────────────────────────────

export interface CohortData {
  month: string;
  cohortSize: number;
  retention: number[];
}

export function getCohortAnalytics(months = 6): Promise<{ cohorts: CohortData[] }> {
  return request(`/api/v1/admin/analytics/cohorts?months=${months}`);
}

// ── Analytics: Revenue ────────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: string;
  volume: number;
  count: number;
  avgTransaction: number;
}

export interface RevenueData {
  monthly: MonthlyRevenue[];
  totals: { volume: number; count: number; avgTransaction: number; activeUsers: number };
}

export function getRevenueAnalytics(months = 12): Promise<RevenueData> {
  return request(`/api/v1/admin/analytics/revenue?months=${months}`);
}

// ── Mini App Reports ──────────────────────────────────────────────────────────

export interface MiniAppReport {
  id: string;
  appId: string;
  reportedByUserId: string;
  reportedByHandle: string | null;
  reason: "SPAM" | "INAPPROPRIATE" | "NOT_WORKING" | "MISLEADING" | "OTHER";
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MiniAppReportStats {
  total: number;
  open: number;
  resolved: number;
  dismissed: number;
}

export function getMiniAppReports(page = 0, size = 20, status?: string): Promise<Page<MiniAppReport>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/miniapps/reports?${params}`);
}

export function getMiniAppReportStats(): Promise<MiniAppReportStats> {
  return request("/api/v1/admin/miniapps/reports/stats");
}

export function resolveMiniAppReport(
  id: string,
  action: "RESOLVE" | "DISMISS",
  resolution: string,
  disableApp = false,
): Promise<MiniAppReport> {
  return request(`/api/v1/admin/miniapps/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, resolution, disableApp }),
  });
}

export interface DisabledMiniApp {
  appId: string;
  reason: string | null;
  disabledBy: string;
  disabledAt: string;
}

export function getDisabledMiniApps(): Promise<DisabledMiniApp[]> {
  return request("/api/v1/admin/miniapps/disabled");
}

export interface AdminMiniApp {
  appId: string;
  name: string;
  category: string;
  description: string;
  status: "ACTIVE" | "MAINTENANCE" | "DISABLED";
  reason: string | null;
  statusSetBy: string | null;
  statusSetAt: string | null;
}

export function getAllMiniApps(): Promise<AdminMiniApp[]> {
  return request("/api/v1/admin/miniapps");
}

/** Puts the app under maintenance and notifies all users (push + in-app). */
export function setMiniAppMaintenance(appId: string, message?: string): Promise<AdminMiniApp> {
  return request(`/api/v1/admin/miniapps/${encodeURIComponent(appId)}/maintenance`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function disableMiniApp(appId: string, reason?: string): Promise<DisabledMiniApp> {
  return request(`/api/v1/admin/miniapps/${encodeURIComponent(appId)}/disable`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Re-enabling goes through maker-checker — may return a pending Approval. */
export function enableMiniApp(appId: string): Promise<void | Approval> {
  return request(`/api/v1/admin/miniapps/${encodeURIComponent(appId)}/enable`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ── Mini app developer submissions ───────────────────────────────────────────

export interface MiniAppSubmission {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl: string;
  url: string;
  developerName: string;
  supportUrl: string | null;
  version: string;
  status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  requestedPermissions: string[];
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export function getMiniAppSubmissions(page = 0, size = 20): Promise<Page<MiniAppSubmission>> {
  return request(`/api/v1/admin/miniapps/submissions?page=${page}&size=${size}`);
}

export function approveMiniApp(appId: string): Promise<MiniAppSubmission> {
  return request(`/api/v1/admin/miniapps/submissions/${encodeURIComponent(appId)}/approve`, {
    method: "POST",
  });
}

export function rejectMiniApp(appId: string, reason: string): Promise<MiniAppSubmission> {
  return request(`/api/v1/admin/miniapps/submissions/${encodeURIComponent(appId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function suspendMiniApp(appId: string, reason: string): Promise<MiniAppSubmission> {
  return request(`/api/v1/admin/miniapps/submissions/${encodeURIComponent(appId)}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ── AI: Fraud Detection ───────────────────────────────────────────────────────

/** HIGH-anomaly transfers intercepted before any money moved. */
export function getHeldTransfers(page = 0, size = 20): Promise<Page<AdminTransaction>> {
  return request(`/api/v1/admin/fraud/held?page=${page}&size=${size}`);
}

export function releaseHeldTransfer(id: string): Promise<unknown> {
  return request(`/api/v1/admin/fraud/held/${id}/release`, { method: "POST" });
}

export function rejectHeldTransfer(id: string): Promise<unknown> {
  return request(`/api/v1/admin/fraud/held/${id}/reject`, { method: "POST" });
}

export interface FraudAiAssessment {
  verdict: "LIKELY_FRAUD" | "LIKELY_LEGITIMATE" | "UNCERTAIN";
  confidence: number;
  reasoning: string;
}

/** Claude second opinion on a held transfer — can take a minute; verdict is audit-logged. */
export function getAiOpinion(id: string): Promise<FraudAiAssessment> {
  return request(`/api/v1/admin/fraud/held/${id}/ai-opinion`, { method: "POST" });
}

export function getAnomalyFlaggedTransactions(
  page = 0,
  size = 20,
  riskLevel?: string,
): Promise<Page<AdminTransaction>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (riskLevel) params.set("riskLevel", riskLevel);
  return request(`/api/v1/admin/fraud/flagged?${params}`);
}

// ── AI: Spending Category Analytics ──────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  count: number;
  total: number;
  percentage: number;
}

export function getAdminCategoryBreakdown(days = 30): Promise<CategoryBreakdown[]> {
  return request(`/api/v1/admin/analytics/categories?days=${days}`);
}

// ── OAuth Apps ────────────────────────────────────────────────────────────────

export interface AdminOAuthStats {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  activeTokens: number;
}

export interface AdminOAuthClient {
  id: string;
  clientId: string;
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  websiteUrl?: string;
  allowedScopes: string[];
  ownerHandle: string;
  ownerEmail: string;
  active: boolean;
  activeTokenCount: number;
  createdAt: string;
}

export function getAdminOAuthStats(): Promise<AdminOAuthStats> {
  return request("/api/v1/admin/oauth/stats");
}

export function getAdminOAuthClients(
  page = 0,
  size = 20,
  query?: string,
  active?: boolean,
): Promise<Page<AdminOAuthClient>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query) params.set("query", query);
  if (active !== undefined) params.set("active", String(active));
  return request(`/api/v1/admin/oauth/clients?${params}`);
}

export function getAdminOAuthClient(clientId: string): Promise<AdminOAuthClient> {
  return request(`/api/v1/admin/oauth/clients/${clientId}`);
}

export function adminSuspendOAuthClient(clientId: string): Promise<AdminOAuthClient> {
  return request(`/api/v1/admin/oauth/clients/${clientId}/suspend`, { method: "POST" });
}

export function adminRestoreOAuthClient(clientId: string): Promise<AdminOAuthClient> {
  return request(`/api/v1/admin/oauth/clients/${clientId}/restore`, { method: "POST" });
}

export function adminDeleteOAuthClient(clientId: string): Promise<void> {
  return request(`/api/v1/admin/oauth/clients/${clientId}`, { method: "DELETE" });
}

// ── Admin step-up (2FA elevation) ─────────────────────────────────────────────

export interface StepUpStatus {
  elevated: boolean;
  method: "TOTP" | "PASSWORD";
}

export function getStepUpStatus(): Promise<StepUpStatus> {
  return request("/api/v1/admin/step-up/status");
}

export function submitStepUp(payload: { code?: string; password?: string }): Promise<{ elevated: boolean }> {
  return request("/api/v1/admin/step-up", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Staff management ──────────────────────────────────────────────────────────

export interface StaffRoleGrant {
  role: StaffRoleName;
  grantedAt: string | null;
  grantedByEmail: string | null;
}

export interface StaffMember {
  userId: string;
  name: string;
  email: string;
  handle: string | null;
  profileImageUrl: string | null;
  roles: StaffRoleGrant[];
}

export function getStaff(): Promise<StaffMember[]> {
  return request("/api/v1/admin/staff");
}

/** Maker-checker once a second staff member exists: may return a pending Approval instead. */
export function grantStaffRole(userId: string, role: StaffRoleName): Promise<StaffMember | Approval> {
  return request(`/api/v1/admin/staff/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export function isPendingApproval(result: unknown): result is Approval {
  return typeof result === "object" && result !== null && "actionType" in result && "summary" in result;
}

export function revokeStaffRole(userId: string, role: StaffRoleName): Promise<StaffMember> {
  return request(`/api/v1/admin/staff/${userId}/roles/${role}`, { method: "DELETE" });
}

/** Atomic swap; maker-checker once a second staff member exists. */
export function changeStaffRole(
  userId: string,
  fromRole: StaffRoleName,
  toRole: StaffRoleName,
): Promise<StaffMember | Approval> {
  return request(`/api/v1/admin/staff/${userId}/change-role`, {
    method: "POST",
    body: JSON.stringify({ fromRole, toRole }),
  });
}

// ── Global payouts (cross-merchant) ──────────────────────────────────────────

export interface GlobalPayout {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  requestedAt: string | null;
  completedAt: string | null;
}

export function getGlobalPayouts(page = 0, size = 20, status?: string): Promise<Page<GlobalPayout>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/merchants/payouts/all?${params}`);
}

// ── Webhook deliveries per merchant ──────────────────────────────────────────

export interface WebhookDeliveryRow {
  id: string;
  endpointId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  responseStatusCode: number | null;
  createdAt: string | null;
  lastAttemptAt: string | null;
}

export function getMerchantWebhookDeliveries(merchantId: string, page = 0, size = 20, status?: string): Promise<Page<WebhookDeliveryRow>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/merchants/${merchantId}/webhook-deliveries?${params}`);
}

// ── User notification history ─────────────────────────────────────────────────

export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function getUserNotifications(userId: string, page = 0, size = 20): Promise<Page<UserNotification>> {
  return request(`/api/v1/admin/users/${userId}/notifications?page=${page}&size=${size}`);
}

// ── Screening EDD notes ───────────────────────────────────────────────────────

export function addEddNote(matchId: string, eddNotes: string): Promise<ScreeningMatch> {
  return request(`/api/v1/admin/screening/matches/${matchId}/edd`, {
    method: "PATCH",
    body: JSON.stringify({ eddNotes }),
  });
}

// ── Regulatory filing calendar ────────────────────────────────────────────────

export interface RegulatoryFilingRecord {
  id: string;
  type: "BOG_MONTHLY_RETURNS" | "STR_BATCH" | "ACCOUNTING_JOURNAL";
  period: string;
  notes: string | null;
  filedByEmail: string;
  filedAt: string;
}

export function getRegulatoryFilings(type?: string): Promise<RegulatoryFilingRecord[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  return request(`/api/v1/admin/regulatory/filings?${params}`);
}

export function markFiled(data: {
  type: string;
  period: string;
  notes?: string;
}): Promise<RegulatoryFilingRecord> {
  return request("/api/v1/admin/regulatory/filings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Authenticated file downloads ──────────────────────────────────────────────

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Maker-checker approvals ───────────────────────────────────────────────────

export interface Approval {
  id: string;
  actionType:
    | "REVERSE_TRANSACTION"
    | "UPDATE_FEE_RULE"
    | "UPDATE_USER_LIMITS"
    | "GRANT_STAFF_ROLE"
    | "CHANGE_STAFF_ROLE"
    | "UPDATE_SYSTEM_SETTINGS"
    | "UNFREEZE_WALLET"
    | "REACTIVATE_USER"
    | "APPROVE_KYC"
    | "BROADCAST_NOTIFICATION"
    | "ENABLE_MINI_APP";
  targetId: string;
  summary: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requestedByEmail: string;
  requestedAt: string;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export function getApprovals(status?: string, page = 0, size = 20): Promise<Page<Approval>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/approvals?${params}`);
}

export function getApprovalStats(): Promise<{ pending: number }> {
  return request("/api/v1/admin/approvals/stats");
}

export function approveRequest(id: string, notes?: string): Promise<Approval> {
  return request(`/api/v1/admin/approvals/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function rejectRequest(id: string, notes?: string): Promise<Approval> {
  return request(`/api/v1/admin/approvals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

// ── Reconciliation & safeguarding ─────────────────────────────────────────────

export interface SafeguardingSnapshot {
  id: string;
  customerFloat: number;
  merchantFloat: number;
  safeguardingBalance: number;
  variance: number;
  breach: boolean;
  recordedBy: string | null;
  createdAt: string;
}

export interface ReconBreak {
  id: string;
  importLabel: string;
  statementReference: string;
  statementAmount: number;
  direction: "CREDIT" | "DEBIT";
  reason: "NO_MATCH" | "AMOUNT_MISMATCH";
  internalAmount: number | null;
  status: "OPEN" | "RESOLVED";
  resolutionNotes: string | null;
  createdAt: string;
}

export function getSafeguardingHistory(page = 0, size = 20): Promise<Page<SafeguardingSnapshot>> {
  return request(`/api/v1/admin/recon/safeguarding?page=${page}&size=${size}`);
}

export function takeSafeguardingSnapshot(safeguardingBalance: number): Promise<SafeguardingSnapshot> {
  return request("/api/v1/admin/recon/safeguarding", {
    method: "POST",
    body: JSON.stringify({ safeguardingBalance }),
  });
}

export function importStatement(label: string, csv: string): Promise<{ matched: number; breaks: number }> {
  return request("/api/v1/admin/recon/import", {
    method: "POST",
    body: JSON.stringify({ label, csv }),
  });
}

export function getReconBreaks(status?: string, page = 0, size = 20): Promise<Page<ReconBreak>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/recon/breaks?${params}`);
}

export function resolveReconBreak(id: string, notes: string): Promise<ReconBreak> {
  return request(`/api/v1/admin/recon/breaks/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

// ── Regulatory filings & accounting exports ───────────────────────────────────

export function downloadStrExport(flaggedId: string): Promise<void> {
  return downloadFile(`/api/v1/admin/regulatory/str/${flaggedId}`, `str-${flaggedId}.xml`);
}

export function downloadMonthlyReturns(month: string): Promise<void> {
  return downloadFile(`/api/v1/admin/regulatory/returns?month=${month}`, `bog-returns-${month}.csv`);
}

export function downloadAccountingJournal(from: string, to: string): Promise<void> {
  return downloadFile(`/api/v1/admin/accounting/journal?from=${from}&to=${to}`, `journal-${from}-to-${to}.csv`);
}

// ── Sanctions / PEP screening ─────────────────────────────────────────────────

export interface WatchlistEntry {
  id: string;
  listName: string;
  fullName: string;
  entryType: "SANCTION" | "PEP";
  country: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface ScreeningMatch {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  listName: string;
  listEntryName: string;
  entryType: "SANCTION" | "PEP";
  matchScore: number;
  status: "PENDING_REVIEW" | "FALSE_POSITIVE" | "CONFIRMED";
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function getScreeningStats(): Promise<{ pendingMatches: number; activeListEntries: number }> {
  return request("/api/v1/admin/screening/stats");
}

export function runScreening(): Promise<{ newMatches: number }> {
  return request("/api/v1/admin/screening/run", { method: "POST" });
}

export function getScreeningMatches(status?: string, page = 0, size = 20): Promise<Page<ScreeningMatch>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/screening/matches?${params}`);
}

export function reviewScreeningMatch(id: string, confirmed: boolean, notes?: string): Promise<ScreeningMatch> {
  return request(`/api/v1/admin/screening/matches/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ confirmed, notes }),
  });
}

export function getWatchlist(): Promise<WatchlistEntry[]> {
  return request("/api/v1/admin/screening/list");
}

export function addWatchlistEntry(data: {
  listName: string;
  fullName: string;
  entryType: string;
  country?: string;
  dateOfBirth?: string;
  notes?: string;
}): Promise<WatchlistEntry> {
  return request("/api/v1/admin/screening/list", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function importUnList(): Promise<{ imported: number }> {
  return request("/api/v1/admin/screening/list/import-un", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ── Risk rules ────────────────────────────────────────────────────────────────

export interface RiskRules {
  largeTransferGhs: string;
  velocityMaxHourly: string;
}

export function getRiskRules(): Promise<RiskRules> {
  return request("/api/v1/admin/risk/rules");
}

export function updateRiskRules(rules: Partial<RiskRules>): Promise<RiskRules> {
  return request("/api/v1/admin/risk/rules", {
    method: "PATCH",
    body: JSON.stringify(rules),
  });
}

// ── Audit log integrity anchors ───────────────────────────────────────────────

export interface AuditAnchor {
  id: string;
  anchorDate: string;
  entryCount: number;
  contentHash: string;
  prevHash: string;
  createdAt: string;
}

export interface AnchorVerification {
  date: string;
  valid: boolean;
  anchoredCount: number;
  currentCount: number;
}

// ── KYC periodic reviews ──────────────────────────────────────────────────────

export interface KycReviewDue {
  userId: string;
  name: string;
  email: string;
  reviewDueAt: string;
}

export function getKycReviewsDue(): Promise<KycReviewDue[]> {
  return request("/api/v1/admin/kyc/reviews-due");
}

// ── Complaints register ───────────────────────────────────────────────────────

export interface Complaint {
  id: string;
  userId: string | null;
  complainantName: string | null;
  complainantContact: string | null;
  channel: "APP" | "EMAIL" | "PHONE" | "IN_PERSON" | "SOCIAL_MEDIA";
  subject: string;
  details: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  ackDueAt: string;
  resolveDueAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
}

export function getComplaints(status?: string, page = 0, size = 20): Promise<Page<Complaint>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/complaints?${params}`);
}

export function getComplaintStats(): Promise<{ open: number; acknowledged: number }> {
  return request("/api/v1/admin/complaints/stats");
}

export function createComplaint(data: {
  userId?: string;
  complainantName?: string;
  complainantContact?: string;
  channel: string;
  subject: string;
  details: string;
}): Promise<Complaint> {
  return request("/api/v1/admin/complaints", { method: "POST", body: JSON.stringify(data) });
}

export function updateComplaintStatus(id: string, status: string, resolution?: string): Promise<Complaint> {
  return request(`/api/v1/admin/complaints/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolution }),
  });
}

export function getAuditAnchors(): Promise<AuditAnchor[]> {
  return request("/api/v1/admin/audit-anchors");
}

export function verifyAuditAnchors(): Promise<AnchorVerification[]> {
  return request("/api/v1/admin/audit-anchors/verify", { method: "POST", body: JSON.stringify({}) });
}

export function importWatchlist(csv: string): Promise<{ imported: number }> {
  return request("/api/v1/admin/screening/list/import", {
    method: "POST",
    body: JSON.stringify({ csv }),
  });
}

export function deactivateWatchlistEntry(id: string): Promise<string> {
  return request(`/api/v1/admin/screening/list/${id}`, { method: "DELETE" });
}

// ── DSAR data requests ────────────────────────────────────────────────────────

export interface DataRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: "ACCESS" | "DELETION";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  dueDate: string;
  overdue: boolean;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function getDataRequests(status?: string, page = 0, size = 20): Promise<Page<DataRequest>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/v1/admin/data-requests?${params}`);
}

export function createDataRequest(userId: string, type: string, notes?: string): Promise<DataRequest> {
  return request("/api/v1/admin/data-requests", {
    method: "POST",
    body: JSON.stringify({ userId, type, notes }),
  });
}

export function updateDataRequestStatus(id: string, status: string, notes?: string): Promise<DataRequest> {
  return request(`/api/v1/admin/data-requests/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export function downloadUserDataExport(userId: string): Promise<void> {
  return downloadFile(`/api/v1/admin/data-requests/user/${userId}/export`, `user-data-${userId}.json`);
}
