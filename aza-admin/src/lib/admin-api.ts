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
      } catch (e) {
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
    // We only kick out on 403 if it's persistent, but for now let's be less aggressive.
    throw new Error("Forbidden: You don't have permission for this action");
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

export function updateUserStatus(userId: string, status: string, reason?: string): Promise<AdminUser> {
  return request(`/api/v1/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export function updateUserRole(userId: string, role: string): Promise<AdminUser> {
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
  return request(`/api/v1/admin/support/chats/${chatId}/messages?page=${page}&size=${size}`);
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
}

export function getAdminTransactions(page = 0, size = 20): Promise<Page<AdminTransaction>> {
  return request(`/api/v1/admin/dashboard/transactions?page=${page}&size=${size}`);
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

export function freezeWallet(userId: string, freeze: boolean): Promise<AdminWallet> {
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

export function getAuditLog(page = 0, size = 20): Promise<Page<AuditLogEntry>> {
  return request(`/api/v1/admin/audit-log?page=${page}&size=${size}`);
}

// ── Broadcast Notifications ───────────────────────────────────────────────────

export interface BroadcastResult {
  sent: number;
}

export function broadcastNotification(
  title: string,
  body: string,
  audience: "ALL" | "KYC_VERIFIED" | "ACTIVE_ONLY"
): Promise<BroadcastResult> {
  return request("/api/v1/admin/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify({ title, body, audience }),
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

// ── Support management ────────────────────────────────────────────────────────

export interface SupportStats {
  open: number;
  resolved: number;
}

export function getSupportStats(): Promise<SupportStats> {
  return request("/api/v1/admin/support/stats");
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

export function reverseTransaction(txId: string): Promise<AdminTransaction> {
  return request(`/api/v1/admin/dashboard/transactions/${txId}/reverse`, { method: "POST" });
}
