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
  featureFlags: {
    biometricEnabled: boolean;
    p2pEnabled: boolean;
    notificationsEnabled: boolean;
  };
}

export function getSystemSettings(): Promise<SystemSettings> {
  return request("/api/v1/admin/settings");
}

export function updateSystemSettings(settings: Partial<Omit<SystemSettings, "platformVersion">>): Promise<SystemSettings> {
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

export function updateFeeRule(id: string, data: Partial<Pick<FeeRule, "amount" | "active" | "minFee" | "maxFee">>): Promise<FeeRule> {
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
): Promise<MiniAppReport> {
  return request(`/api/v1/admin/miniapps/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, resolution }),
  });
}
