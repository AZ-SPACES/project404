import axios from "axios";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { emitAuthEvent } from "../providers/authEvents";
import { encryptMedia } from "../crypto/mediaCrypto";
import { base64ToBytes, bytesToBase64 } from "../crypto/codec";

/**
 * File payload shape required by React Native's FormData for binary uploads.
 * Matches the object accepted by expo-image-picker and expo-document-picker results.
 */
export type RNFile = {
  uri: string;
  type: string;
  name: string;
};

/** Subset of user profile fields the PUT /users/me endpoint accepts. */
export type UserUpdateRequest = {
  handle?: string;
  profileImageUrl?: string;
  theme?: string;
  language?: string;
  homeBackground?: string;
  hubBackground?: string;
  quickActions?: string;
  transactionGrouping?: string;
  transactionDensity?: string;
  balanceHiddenByDefault?: boolean;
  homeDim?: number;
  homeBlur?: number;
  homeLayout?: string;
  homeBannerGradient?: string;
  accentId?: string;
  balanceCardStyle?: string;
  reducedMotion?: boolean;
};

const getBaseUrl = (): string => {
  return "https://api.aza.systems";
};

export const BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Keys for secure store
export const TOKEN_KEY = "aza_access_token";
export const REFRESH_TOKEN_KEY = "aza_refresh_token";
export const BIOMETRIC_TOKEN_KEY = "aza_biometric_token";
export const DEVICE_ID_KEY = "aza_device_id";
export const BYPASS_TOKEN_KEY = "aza_bypass_token";

let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (cb: () => void) => {
  onAuthFailure = cb;
};

// Allows AuthProvider to register a callback that fires when the API
// receives a 403 (token revoked / invalid). The interceptor cannot
// import AuthProvider directly (circular dependency), so we use this
// registration pattern instead.
let _forceLogout: (() => void) | null = null;
export const setForceLogoutHandler = (handler: () => void) => {
  _forceLogout = handler;
};

export const getDeviceId = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
};

export const biometricEnroll = (
  passcode: string,
  deviceId: string,
  deviceName: string,
  deviceOs: string,
) =>
  api.post("/api/v1/auth/biometric-token", {
    passcode,
    deviceId,
    deviceName,
    deviceOs,
  });

export const biometricLogin = (biometricToken: string, deviceId: string) =>
  api.post("/api/v1/auth/biometric-login", { biometricToken, deviceId });

export const registerFcmToken = (
  token: string,
  deviceId: string,
  deviceName: string,
  platform: string,
) =>
  api.post("/api/v1/notifications/fcm-token", {
    token,
    deviceId,
    deviceName,
    platform,
  });

export const unregisterFcmToken = (deviceId: string) =>
  api.delete(`/api/v1/notifications/fcm-token/${deviceId}`);

export const getNotifications = (page: number = 0, size: number = 20) =>
  api.get(`/api/v1/notifications?page=${page}&size=${size}`);

export const getUnreadNotificationCount = () =>
  api.get("/api/v1/notifications/unread-count");

export const markAllNotificationsAsRead = () =>
  api.put("/api/v1/notifications/read-all");

export const markNotificationAsRead = (id: string) =>
  api.put(`/api/v1/notifications/${id}/read`);

export const deleteAllNotifications = () =>
  api.delete("/api/v1/notifications");

export const totpLogin = (preAuthToken: string, code: string, deviceName?: string, deviceOs?: string, deviceId?: string) =>
  api.post("/api/v1/auth/2fa/login", { preAuthToken, code, deviceName, deviceOs, deviceId });

// --- KYC Endpoints ---

export const getKycStatus = () => api.get("/api/v1/kyc/status");

export const recordKycConsent = () => api.post("/api/v1/kyc/consent");

export const submitFundsSource = (
  fundsSource: string,
  otherFundsText?: string,
) => api.post("/api/v1/kyc/funds-source", { fundsSource, otherFundsText });

export const submitIdentity = (
  idType: string,
  idNumber: string,
  frontImage: RNFile,
  backImage: RNFile,
) => {
  const formData = new FormData();
  formData.append("idType", idType);
  formData.append("idNumber", idNumber);
  formData.append("frontImage", frontImage as any);
  formData.append("backImage", backImage as any);

  return api.post("/api/v1/kyc/identity", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const submitSelfie = (selfie: RNFile) => {
  const formData = new FormData();
  formData.append("selfie", selfie as any);

  return api.post("/api/v1/kyc/selfie", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const submitPepScreening = (
  isPep: boolean,
  pepStatus?: string,
  pepRole?: string,
) => {
  const body: Record<string, unknown> = { isPep };
  if (pepStatus) body.pepStatus = pepStatus;
  if (pepRole) body.pepRole = pepRole;
  return api.post("/api/v1/kyc/pep-screening", body);
};

export const submitPepDetails = (
  accountPurpose: string,
  monthlyVolume: string,
  wealthSource: string,
) =>
  api.post("/api/v1/kyc/pep-details", {
    accountPurpose,
    monthlyVolume,
    wealthSource,
  });

export const submitProofOfWealth = (document: RNFile) => {
  const formData = new FormData();
  formData.append("document", document as any);

  return api.post("/api/v1/kyc/proof-of-wealth", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const submitKycFinal = () => api.post("/api/v1/kyc/submit");

export const resubmitKyc = () => api.post("/api/v1/kyc/resubmit");

// --- User Endpoints ---

export const getMe = () => api.get("/api/v1/users/me");

export const getUserLimits = (): Promise<{ data: { data: { dailyLimitGhs: number; singleTransactionLimitGhs: number } } }> =>
  api.get("/api/v1/users/me/limits");

export const getTodaySent = () => api.get("/api/v1/wallet/today-sent");

export const requestLimitIncrease = (data: {
  requestedDailyLimitGhs: number;
  requestedSingleTransactionLimitGhs: number;
  reason: string;
}) => api.post("/api/v1/users/me/limits/request", data);

export const updateMe = (data: UserUpdateRequest) => api.put("/api/v1/users/me", data);

export const uploadProfileImage = (file: RNFile) => {
  const formData = new FormData();
  formData.append("file", file as any);
  return api.put("/api/v1/users/me/profile-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadHomeBackground = (file: RNFile) => {
  const formData = new FormData();
  formData.append("file", file as any);
  return api.put("/api/v1/users/me/home-background", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadHubBackground = (file: RNFile) => {
  const formData = new FormData();
  formData.append("file", file as any);
  return api.put("/api/v1/users/me/hub-background", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const checkHandleAvailability = (handle: string) =>
  api.get(`/api/v1/users/check-handle?handle=${encodeURIComponent(handle)}`);

export const checkEmailAvailability = (email: string) =>
  api.get(`/api/v1/users/check-email?email=${encodeURIComponent(email)}`);

export const checkPhoneAvailability = (phone: string) =>
  api.get(`/api/v1/users/check-phone?phone=${encodeURIComponent(phone)}`);

export const suggestHandles = (firstName: string, lastName: string) =>
  api.get(
    `/api/v1/users/suggest-handles?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`,
  );

export const requestEmailChange = (email: string) =>
  api.post(`/api/v1/users/me/email/request?email=${encodeURIComponent(email)}`);

export const verifyEmailChange = (email: string, code: string) =>
  api.post("/api/v1/users/me/email/verify", { identifier: email, code, purpose: "change_email" });

export const requestPhoneChange = (phone: string) =>
  api.post(`/api/v1/users/me/phone/request?phone=${encodeURIComponent(phone)}`);

export const verifyPhoneChange = (phone: string, code: string) =>
  api.post("/api/v1/users/me/phone/verify", { identifier: phone, code, purpose: "change_phone" });

// --- Feedback ---

/** Submit in-app product feedback (rating 1–5 + optional comment, tagged by context). */
export const submitFeedback = (rating: number, comment?: string, context?: string) =>
  api.post("/api/v1/feedback", { rating, comment, context });

// --- Support Endpoints ---

export const getOrCreateSupportChat = () => api.post("/api/v1/support/chat");

export const getSupportMessages = (page = 0, size = 50) =>
  api.get(`/api/v1/support/chat/messages?page=${page}&size=${size}&_t=${Date.now()}`);

export const sendSupportMessage = (content: string) =>
  api.post("/api/v1/support/chat/message", { content });

export const sendSupportAttachment = (fileUri: string, mimeType: string, caption?: string) => {
  const form = new FormData();
  form.append('file', { uri: fileUri, type: mimeType, name: 'attachment' } as any);
  if (caption) form.append('caption', caption);
  return api.post('/api/v1/support/chat/message/attachment', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getAvailableSupportAgents = () =>
  api.get("/api/v1/support/agents/available");

export const initiateCall = (calleeId: string, type: "VOICE" | "VIDEO") =>
  api.post("/api/v1/calls", { calleeId, type });

export const ringCall = (callId: string) => api.post(`/api/v1/calls/${callId}/ring`);
export const acceptCall = (callId: string) => api.post(`/api/v1/calls/${callId}/accept`);
export const declineCall = (callId: string) => api.post(`/api/v1/calls/${callId}/decline`);
export const endCall = (callId: string) => api.post(`/api/v1/calls/${callId}/end`);
export const relaySdpOffer = (callId: string, data: string) => api.post('/api/v1/calls/sdp-offer', { callId, data });
export const relaySdpAnswer = (callId: string, data: string) => api.post('/api/v1/calls/sdp-answer', { callId, data });
export const relayIceCandidate = (callId: string, data: string) => api.post('/api/v1/calls/ice-candidate', { callId, data });
export const getTurnCredentials = () => api.get('/api/v1/calls/turn-credentials');
export const getCallHistory = (page = 0, size = 50) => api.get(`/api/v1/calls/history?page=${page}&size=${size}`);
export const getMissedCalls = () => api.get('/api/v1/calls/missed');
export const reconnectCall = (callId: string) => api.post(`/api/v1/calls/${callId}/reconnect`);
export const confirmReconnected = (callId: string) => api.post(`/api/v1/calls/${callId}/reconnected`);

// --- Contact Endpoints ---

export const getContacts = (page = 0, size = 50) =>
  api.get(`/api/v1/contacts?page=${page}&size=${size}`);

export const syncContacts = (contacts: any[]) =>
  api.post("/api/v1/contacts/sync", { contacts });

export const unsyncContacts = () =>
  api.delete("/api/v1/contacts/sync");

export const searchContacts = (q: string, page = 0, size = 20) =>
  api.get(
    `/api/v1/contacts/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`,
  );

export const getContactDetails = (id: string) =>
  api.get(`/api/v1/contacts/${id}`);

export const markContactFavorite = (id: string) =>
  api.post(`/api/v1/contacts/${id}/favorite`);

export const unmarkContactFavorite = (id: string) =>
  api.delete(`/api/v1/contacts/${id}/favorite`);

export const blockUser = (userId: string) =>
  api.post(`/api/v1/contacts/block/${userId}`);

export const unblockUser = (userId: string) =>
  api.delete(`/api/v1/contacts/block/${userId}`);

export const getBlockedUsers = () => api.get("/api/v1/contacts/blocked");

export const addContact = (userId: string) =>
  api.post(`/api/v1/contacts/add/${userId}`);

export const requestContact = (userId: string) =>
  api.post(`/api/v1/contacts/request/${userId}`);

export const getContactRequests = () =>
  api.get("/api/v1/contacts/requests");

export const getSentContactRequests = () =>
  api.get("/api/v1/contacts/requests/sent");

export const approveContactRequest = (requestId: string) =>
  api.post(`/api/v1/contacts/requests/${requestId}/approve`);

export const rejectContactRequest = (requestId: string) =>
  api.post(`/api/v1/contacts/requests/${requestId}/reject`);

export const getUserByHandle = (handle: string) =>
  api.get(`/api/v1/users/by-handle/${handle}`);

export const searchUsersGlobal = (q: string, page = 0, size = 20) =>
  api.get(
    `/api/v1/users/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`,
  );

// --- Wallet & Transfer Endpoints ---

export const getWalletBalance = () => api.get("/api/v1/wallet/balance");

export const getSpendingSummary = () => api.get("/api/v1/wallet/spending");

export const getYearlySpendingSummary = (year?: number) =>
  api.get(`/api/v1/wallet/spending/yearly${year ? `?year=${year}` : ""}`);

export const getTransactions = (page = 0, size = 20, type?: string, status?: string, direction?: string) =>
  api.get(`/api/v1/transfers?page=${page}&size=${size}${type ? `&type=${type}` : ""}${status ? `&status=${status}` : ""}${direction ? `&direction=${direction}` : ""}`);

export const getTransactionsStatement = (startDate: string, endDate: string) =>
  api.get(`/api/v1/transfers/statement?startDate=${startDate}&endDate=${endDate}`, {
    responseType: "blob",
  });

export const sendTransactionsStatementEmail = (startDate: string, endDate: string) =>
  api.post(`/api/v1/transfers/statement/email?startDate=${startDate}&endDate=${endDate}`);

export const verifyStatement = (code: string) =>
  api.get(`/api/v1/public/statements/verify?code=${encodeURIComponent(code)}`);

// Payment proof (verifiable "I paid this" QR)
export const getPaymentProof = (transactionId: string) =>
  api.get(`/api/v1/payments/${encodeURIComponent(transactionId)}/proof`);

export const verifyPayment = (ref: string, sig: string) =>
  api.get(`/api/v1/public/payments/verify?ref=${encodeURIComponent(ref)}&sig=${encodeURIComponent(sig)}`);

// Report a payment handle / store code (scam, impersonation, …)
export const reportHandle = (handle: string, reason: string, details?: string) =>
  api.post(`/api/v1/reports/handle`, { handle, reason, ...(details ? { details } : {}) });

export const getPublicMerchant = (handle: string) =>
  api.get(`/api/v1/merchant/public/${encodeURIComponent(handle)}`);

export const initiateTransfer = (payload: {
  recipientIdentifier: string;
  amount: number;
  note: string;
  idempotencyKey: string;
  category?: string;
  gpsLocation?: string;
}) => api.post("/api/v1/transfers", payload);

export const confirmTransfer = (id: string, passcode: string) =>
  api.post(`/api/v1/transfers/${id}/confirm`, { passcode });

export const cancelTransfer = (id: string) =>
  api.post(`/api/v1/transfers/${id}/cancel`);

export const getTransaction = (id: string) =>
  api.get(`/api/v1/transfers/${encodeURIComponent(id)}`);

export const requestMoney = (payload: {
  fromIdentifier: string;
  amount: number;
  note: string;
}) => api.post("/api/v1/money-requests", payload);

// --- Legal consent (DPA evidence) ---

/** Bump these when the legal documents change; users re-accept and a new row is recorded server-side. */
export const LEGAL_DOC_VERSIONS = { TERMS: "1.0", PRIVACY: "1.0" } as const;

export const recordConsent = (docType: keyof typeof LEGAL_DOC_VERSIONS) =>
  api.post("/api/v1/consents", { docType, version: LEGAL_DOC_VERSIONS[docType] });

export const getMyConsents = () => api.get("/api/v1/consents/me");

export const acceptMoneyRequest = (id: string, passcode: string) =>
  api.post(`/api/v1/money-requests/${id}/accept`, { passcode });

export const declineMoneyRequest = (id: string) =>
  api.post(`/api/v1/money-requests/${id}/decline`);

// --- Security & Privacy Endpoints ---

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post("/api/v1/auth/change-password", { currentPassword, newPassword });

export const forgotPassword = (identifier: string) =>
  api.post("/api/v1/auth/forgot-password", { identifier });

export const initAccountRecovery = (email: string) =>
  api.post(`/api/v1/auth/account-recovery/init?email=${encodeURIComponent(email)}`);

export const resetPassword = (identifier: string, code: string, newPassword: string) =>
  api.post("/api/v1/auth/reset-password", { identifier, code, newPassword });

export const verifyOtp = (identifier: string, code: string, purpose: string, deviceName?: string, deviceOs?: string, deviceId?: string) =>
  api.post("/api/v1/auth/verify-otp", { identifier, code, purpose, deviceName, deviceOs, deviceId });

export const logout = () =>
  api.post("/api/v1/auth/logout");

export const logoutEverywhere = () =>
  api.post("/api/v1/auth/logout-everywhere");

export const secureAccount = () =>
  api.post("/api/v1/auth/secure-account");

export const getDevices = () => api.get("/api/v1/users/me/devices");

export const getUserPresence = (userId: string) =>
  api.get(`/api/v1/users/${encodeURIComponent(userId)}/presence`);

export const getPresenceBatch = (userIds: string[]) =>
  api.post("/api/v1/users/presence/batch", { userIds });

export const removeSelfEverywhere = () =>
  api.delete("/api/v1/users/me/privacy");

export const deleteAccount = () =>
  api.delete("/api/v1/users/me");

export const cancelAccountDeletion = () =>
  api.post("/api/v1/users/me/cancel-deletion");

export const removeDevice = (deviceId: string) =>
  api.delete(`/api/v1/users/me/devices/${encodeURIComponent(deviceId)}`);

export const updatePrivacySettings = (settings: {
  findMeByPhone?: boolean;
  findMeByEmail?: boolean;
  findMeByHandle?: boolean;
  syncContacts?: boolean;
  billForwardingEnabled?: boolean;
  biometricsEnabled?: boolean;
}) => api.put("/api/v1/users/me/privacy", settings);

export const updateNotificationPreferences = (preferences: Record<string, boolean>) =>
  api.put("/api/v1/users/me/notifications", preferences);

export interface SilentHoursPayload {
  enabled: boolean;
  startTime?: string | undefined;
  endTime?: string | undefined;
  paymentThreshold?: number | null | undefined;
}
export const updateSilentHours = (payload: SilentHoursPayload) =>
  api.put("/api/v1/users/me/silent-hours", payload);

// --- 2FA / TOTP Endpoints ---

export const initiateTotpSetup = () => api.post("/api/v1/auth/2fa/setup");

export const confirmTotpSetup = (code: string) =>
  api.post("/api/v1/auth/2fa/confirm", { code });

export const disableTotp = (code: string) =>
  api.delete("/api/v1/auth/2fa", { data: { code } });

export const getRecoveryCodeCount = () =>
  api.get('/api/v1/auth/2fa/recovery/count');

export const requestRecoveryRegenSms = () =>
  api.post('/api/v1/auth/2fa/recovery/sms/request');

export const regenerateRecoveryCodes = (code: string, method: 'TOTP' | 'SMS' = 'TOTP') =>
  api.post(`/api/v1/auth/2fa/recovery/regenerate?method=${method}`, { code });

export const redeemRecoveryCode = (preAuthToken: string, recoveryCode: string) =>
  api.post("/api/v1/auth/2fa/recovery", { preAuthToken, recoveryCode });

export const initiateSms2faSetup = () =>
  api.post('/api/v1/auth/2fa/sms/setup');

export const confirmSms2faSetup = (code: string) =>
  api.post('/api/v1/auth/2fa/sms/confirm', { code });

export const requestDisableSms2fa = () =>
  api.post('/api/v1/auth/2fa/sms/disable/request');

export const disableSms2fa = (code: string) =>
  api.delete('/api/v1/auth/2fa/sms', { data: { code } });

export const enablePasskeys = () =>
  api.put('/api/v1/users/me/privacy', { passkeysEnabled: true });

export const disablePasskeys = () =>
  api.put('/api/v1/users/me/privacy', { passkeysEnabled: false });

export const verifyPasskeys2fa = (preAuthToken: string, biometricToken: string, deviceId: string) =>
  api.post(`/api/v1/auth/2fa/passkeys/verify?preAuthToken=${preAuthToken}`, { biometricToken, deviceId });

export const requestApp2faApproval = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/app/request?preAuthToken=${preAuthToken}`);

export const respondToApp2faApproval = (requestId: string, approve: boolean) =>
  api.post(`/api/v1/auth/2fa/app/respond?requestId=${encodeURIComponent(requestId)}&approve=${approve}`);

export const checkApp2faStatus = (preAuthToken: string, requestId: string) =>
  api.post(`/api/v1/auth/2fa/app/status?preAuthToken=${preAuthToken}&requestId=${requestId}`);

export const requestSms2fa = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/sms/request?preAuthToken=${preAuthToken}`);

export const requestEmail2fa = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/email/request?preAuthToken=${preAuthToken}`);

export const verify2faOtp = (preAuthToken: string, code: string, method: string) =>
  api.post(`/api/v1/auth/2fa/otp/verify?preAuthToken=${preAuthToken}&code=${code}&method=${method}`);

export const setDefault2faMethod = (method: string) =>
  api.put(`/api/v1/auth/2fa/default-method?method=${method}`);

// --- Account Recovery Contacts ---

export const getMyRecoveryContacts = () =>
  api.get('/api/v1/auth/recovery-contact');

export const getPendingRecoveryInvitations = () =>
  api.get('/api/v1/auth/recovery-contact/pending-invitations');

export const inviteRecoveryContact = (contactUserId: string) =>
  api.post('/api/v1/auth/recovery-contact/invite', { contactUserId });

export const acceptRecoveryInvite = (entryId: string) =>
  api.post(`/api/v1/auth/recovery-contact/${entryId}/accept`);

export const declineRecoveryInvite = (entryId: string) =>
  api.post(`/api/v1/auth/recovery-contact/${entryId}/decline`);

export const removeRecoveryContact = (entryId: string) =>
  api.delete(`/api/v1/auth/recovery-contact/${entryId}`);

export const removeAsRecoveryContact = (entryId: string) =>
  api.delete(`/api/v1/auth/recovery-contact/${entryId}/as-contact`);

export const generateRecoveryContactCode = (requestId: string) =>
  api.post(`/api/v1/auth/recovery-contact/generate?requestId=${requestId}`);

export const getAvailableRecoveryContacts = (preAuthToken: string) =>
  api.get(`/api/v1/auth/recovery-contact/available?preAuthToken=${preAuthToken}`);

export const requestContactRecovery = (preAuthToken: string, entryId: string) =>
  api.post(`/api/v1/auth/recovery-contact/request?preAuthToken=${preAuthToken}&entryId=${entryId}`);

export const redeemContactRecoveryCode = (preAuthToken: string, requestId: string, code: string) =>
  api.post(`/api/v1/auth/recovery-contact/redeem?preAuthToken=${preAuthToken}&requestId=${requestId}`, { code });

// --- Rate limit challenge ---

export const verifyChallenge = (challengeToken: string, captchaResponse: string) =>
  api.post("/api/v1/security/verify-challenge", { challengeToken, captchaResponse });

/** Saves a bypass token so all future requests include X-Bypass-Token automatically. */
export const saveBypassToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(BYPASS_TOKEN_KEY, token);
};

export const clearBypassToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(BYPASS_TOKEN_KEY);
};

// --- Agent (cash network) Endpoints ---

export const getAgent = () => api.get('/api/v1/agent/me');

export const applyAgent = (data: {
  location?: string;
  businessName?: string;
  contactPhone?: string;
  idNumber?: string;
  expectedMonthlyVolumeGhs?: number;
  applicationNotes?: string;
}) => api.post('/api/v1/agent/apply', data);

export const agentCashIn = (data: {
  customerIdentifier: string;
  amount: number;
  idempotencyKey?: string;
}) => api.post('/api/v1/agent/cash-in', data);

export const agentCashOut = (data: { code: string; idempotencyKey?: string }) =>
  api.post('/api/v1/agent/cash-out/redeem', data);

export const getAgentTransactions = (page = 0, size = 20) =>
  api.get(`/api/v1/agent/transactions?page=${page}&size=${size}`);

export const generateWithdrawalCode = (data: { amount: number }) =>
  api.post('/api/v1/withdrawal-codes', data);

// --- Merchant Endpoints ---

export const getMerchant = () => api.get('/api/v1/merchant/me');

export const checkMerchantHandleAvailability = (handle: string) =>
  api.get(`/api/v1/merchant/check-handle?handle=${handle}`);

export const registerMerchant = (data: {
  businessName: string;
  businessHandle: string;
  businessEmail?: string;
  businessPhone?: string;
  businessDescription?: string;
  category?: string;
}) => api.post('/api/v1/merchant/register', data);

export const uploadMerchantLogo = (file: RNFile) => {
  const formData = new FormData();
  formData.append('file', file as any);
  return api.post('/api/v1/merchant/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getMerchantKybStatus = () => api.get('/api/v1/merchant/kyb');

export const submitMerchantKyb = (data: {
  businessType: string;
  registrationNumber?: string;
  registeredAddress?: string;
  city?: string;
  taxIdNumber?: string;
  website?: string;
  ownerFullName: string;
  ownerIdType?: string;
  ownerIdNumber?: string;
}) => api.post('/api/v1/merchant/kyb', data);

export const uploadKybDocument = (file: RNFile, type: string) => {
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('type', type);
  return api.post('/api/v1/merchant/kyb/document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const submitKybFinal = () => api.post('/api/v1/merchant/kyb/submit');

export const getMerchantSessions = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/sessions?page=${page}&size=${size}`);

export const createMerchantSession = (data: {
  amount: number;
  description?: string;
  metadata?: string;
  successUrl?: string;
  cancelUrl?: string;
}) => api.post('/api/v1/merchant/sessions', data);

export const getMerchantApiKeys = () => api.get('/api/v1/merchant/api-keys');

export const createMerchantApiKey = (data: {
  label?: string;
  environment?: 'LIVE' | 'TEST';
  type?: 'SECRET' | 'RESTRICTED';
  scopes?: string;
  ipWhitelist?: string;
  expirationDays?: number;
}) => api.post('/api/v1/merchant/api-keys', data);

export const updateMerchantApiKey = (keyId: string, data: {
  label?: string;
  ipWhitelist?: string;
  scopes?: string;
}) => api.put(`/api/v1/merchant/api-keys/${keyId}`, data);

export const rollMerchantApiKey = (keyId: string, expirationHours?: number) =>
  api.post(`/api/v1/merchant/api-keys/${keyId}/roll`, { expirationHours });

export const getMerchantApiLogs = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/api-keys/logs?page=${page}&size=${size}`);

export const revokeMerchantApiKey = (keyId: string) =>
  api.delete(`/api/v1/merchant/api-keys/${keyId}`);

export const getMerchantWebhooks = () => api.get('/api/v1/merchant/webhooks');

export const createMerchantWebhook = (url: string, events: string) =>
  api.post('/api/v1/merchant/webhooks', { url, events });

export const updateMerchantWebhook = (endpointId: string, data: { url?: string; events?: string; isActive?: boolean }) =>
  api.put(`/api/v1/merchant/webhooks/${endpointId}`, data);

export const deleteMerchantWebhook = (endpointId: string) =>
  api.delete(`/api/v1/merchant/webhooks/${endpointId}`);

export const getMerchantWebhookDeliveries = (endpointId: string) =>
  api.get(`/api/v1/merchant/webhooks/${endpointId}/deliveries`);

export const getMerchantPayouts = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/payouts?page=${page}&size=${size}`);

export const requestMerchantPayout = (amount: number, passcode: string) =>
  api.post('/api/v1/merchant/payouts', { amount, passcode });

export const getMerchantCustomers = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/customers?page=${page}&size=${size}`);

export const getMerchantDisputes = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/disputes?page=${page}&size=${size}`);

export const respondToMerchantDispute = (disputeId: string, response: string) =>
  api.post(`/api/v1/merchant/disputes/${disputeId}/respond`, { response });

export const getCustomerSessions = (customerId: string, page = 0, size = 20) =>
  api.get(`/api/v1/merchant/customers/${customerId}/sessions?page=${page}&size=${size}`);

export const getMerchantProducts = (page = 0, size = 50, active?: boolean) =>
  api.get(`/api/v1/merchant/products?page=${page}&size=${size}${active !== undefined ? `&active=${active}` : ''}`);

export const createMerchantProduct = (data: {
  name: string; price: number; currency?: string;
  description?: string; sku?: string; imageUrl?: string;
}) => api.post('/api/v1/merchant/products', data);

export const updateMerchantProduct = (id: string, data: {
  name?: string; price?: number; description?: string;
  sku?: string; imageUrl?: string; active?: boolean;
}) => api.put(`/api/v1/merchant/products/${id}`, data);

export const deleteMerchantProduct = (id: string) =>
  api.delete(`/api/v1/merchant/products/${id}`);

export const requestWithdrawal = (data: {
  amount: number; provider: string; destination: string;
  bankName?: string; passcode: string;
}) => api.post('/api/v1/withdrawals', data);

export const getWithdrawals = (page = 0, size = 20) =>
  api.get(`/api/v1/withdrawals?page=${page}&size=${size}`);

export const getMerchantAuditLogs = (page = 0, size = 30) =>
  api.get(`/api/v1/merchant/audit-logs?page=${page}&size=${size}`);

export const refundMerchantSession = (sessionId: string) =>
  api.post(`/api/v1/merchant/sessions/${sessionId}/refund`);

export const getMerchantInvoices = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/invoices?page=${page}&size=${size}`);

export const createMerchantInvoice = (data: {
  customerName: string;
  customerEmail: string;
  amount: number;
  currency?: string;
  description?: string;
  dueDate?: string;
}) => api.post('/api/v1/merchant/invoices', data);

export const sendMerchantInvoice = (invoiceId: string) =>
  api.post(`/api/v1/merchant/invoices/${invoiceId}/send`);

export const cancelMerchantInvoice = (invoiceId: string) =>
  api.delete(`/api/v1/merchant/invoices/${invoiceId}`);

export const getMerchantSettlements = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/settlements?page=${page}&size=${size}`);

export const getMerchantDiscountCodes = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/discount-codes?page=${page}&size=${size}`);

export const createMerchantDiscountCode = (data: {
  code?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxUses?: number;
  expiresAt?: string;
}) => api.post('/api/v1/merchant/discount-codes', data);

export const updateMerchantDiscountCode = (codeId: string, data: {
  active?: boolean;
  maxUses?: number;
  expiresAt?: string;
}) => api.put(`/api/v1/merchant/discount-codes/${codeId}`, data);

export const deleteMerchantDiscountCode = (codeId: string) =>
  api.delete(`/api/v1/merchant/discount-codes/${codeId}`);

export const getMerchantReportSummary = () =>
  api.get('/api/v1/merchant/reports/summary');

export const updateMerchant = (data: {
  businessName?: string | undefined;
  businessEmail?: string | undefined;
  businessPhone?: string | undefined;
  businessDescription?: string | undefined;
  brandColor?: string | undefined;
  checkoutTagline?: string | undefined;
  supportEmail?: string | undefined;
  taxEnabled?: boolean | undefined;
  taxRate?: number | undefined;
  taxLabel?: string | undefined;
}) => api.put('/api/v1/merchant/me', data);

export const getMerchantAutoPayoutSettings = () =>
  api.get('/api/v1/merchant/auto-payout');

export const updateMerchantAutoPayoutSettings = (data: {
  autoPayoutEnabled?: boolean | undefined;
  autoPayoutSchedule?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined;
  autoPayoutMinBalance?: number | undefined;
  autoPayoutDay?: number | undefined;
}) => api.put('/api/v1/merchant/auto-payout', data);

export const getMerchantNotificationPrefs = () =>
  api.get('/api/v1/merchant/notification-preferences');

export const updateMerchantNotificationPrefs = (data: {
  emailPaymentReceived?: boolean | undefined;
  emailDisputeOpened?: boolean | undefined;
  emailPayoutCompleted?: boolean | undefined;
  emailPayoutFailed?: boolean | undefined;
  emailInvoicePaid?: boolean | undefined;
  emailWeeklySummary?: boolean | undefined;
  emailApiKeyCreated?: boolean | undefined;
  emailLowBalance?: boolean | undefined;
  lowBalanceThreshold?: number | undefined;
}) => api.put('/api/v1/merchant/notification-preferences', data);

export const getMerchantTeam = () => api.get('/api/v1/merchant/team');

export const inviteMerchantTeamMember = (email: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER') =>
  api.post('/api/v1/merchant/team/invite', { email, role });

export const updateMerchantTeamMemberRole = (memberId: string, role: 'ADMIN' | 'DEVELOPER' | 'VIEWER') =>
  api.put(`/api/v1/merchant/team/${memberId}/role`, { role });

export const removeMerchantTeamMember = (memberId: string) =>
  api.delete(`/api/v1/merchant/team/${memberId}`);

export const getMerchantPlans = () => api.get('/api/v1/merchant/plans');

export const createMerchantPlan = (data: {
  name: string;
  description?: string | undefined;
  amount: number;
  interval: string;
}) => api.post('/api/v1/merchant/plans', data);

export const updateMerchantPlan = (planId: string, data: {
  name?: string | undefined;
  description?: string | undefined;
  amount?: number | undefined;
  interval?: string | undefined;
}) => api.put(`/api/v1/merchant/plans/${planId}`, data);

export const deactivateMerchantPlan = (planId: string) =>
  api.delete(`/api/v1/merchant/plans/${planId}`);

export const getMerchantSubscriptions = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/subscriptions?page=${page}&size=${size}`);

export const createMerchantSubscription = (data: {
  planId: string;
  customerName: string;
  customerEmail?: string | undefined;
  customerId?: string | undefined;
}) => api.post('/api/v1/merchant/subscriptions', data);

export const cancelMerchantSubscription = (subscriptionId: string) =>
  api.delete(`/api/v1/merchant/subscriptions/${subscriptionId}`);

export const expireMerchantSession = (sessionId: string) =>
  api.post(`/api/v1/merchant/sessions/${sessionId}/expire`);

// --- Checkout Endpoints ---

export const getCheckoutSession = (sessionId: string) =>
  api.get(`/api/v1/checkout/${sessionId}`);

export const confirmCheckoutPayment = (sessionId: string, passcode: string) =>
  api.post(`/api/v1/checkout/${sessionId}/confirm`, { passcode });

// --- Mini App Endpoints ---

export const reportMiniApp = (appId: string, reason: string, details?: string) =>
  api.post(`/api/v1/miniapps/${appId}/report`, { reason, details });

export const getDisabledMiniApps = () =>
  api.get('/api/v1/miniapps/disabled');

export const getMiniAppStatuses = () =>
  api.get('/api/v1/miniapps/statuses');

export const getCommunityMiniApps = () =>
  api.get('/api/v1/miniapps');

// --- Developer Mini App Endpoints ---

export const getMyMiniApps = () => api.get('/api/v1/dev/miniapps');

export const saveMiniApp = (data: {
  id: string; name: string; description: string; category: string;
  iconUrl?: string; url: string; developerName: string; supportUrl?: string;
  version: string; requestedPermissions: string[]; submitForReview: boolean;
}) => api.put('/api/v1/dev/miniapps', data);

export const resubmitMiniApp = (appId: string) =>
  api.post(`/api/v1/dev/miniapps/${appId}/resubmit`);

export const getMiniAppConsent = (appId: string) =>
  api.get(`/api/v1/sdk/miniapps/${appId}/consent`);

export const grantMiniAppConsent = (appId: string, permissions: string[]) =>
  api.post(`/api/v1/sdk/miniapps/${appId}/consent`, { permissions });

export const revokeMiniAppConsent = (appId: string) =>
  api.delete(`/api/v1/sdk/miniapps/${appId}/consent`);

export const getSdkUser = (appId: string) =>
  api.get(`/api/v1/sdk/miniapps/${appId}/user`);

export const getSdkBalance = (appId: string) =>
  api.get(`/api/v1/sdk/miniapps/${appId}/balance`);

export const sdkPayment = (appId: string, payload: {
  amount: number;
  recipientIdentifier: string;
  note?: string;
  idempotencyKey: string;
}) => api.post(`/api/v1/sdk/miniapps/${appId}/payment`, payload);

// --- Dispute / Reversal Endpoints ---

export const createDispute = (payload: { transactionId: string; category: string; description: string }) =>
  api.post("/api/v1/disputes", payload);

export const getUserDisputes = (page = 0, size = 20) =>
  api.get(`/api/v1/disputes?page=${page}&size=${size}`);

// --- E2EE Chat Endpoints ---

/** One encrypted envelope for a single device, produced by encryptForRecipient. */
export type DeviceCiphertext = {
  ciphertext: string;
  ephemeralKey: string;
  preKeyId?: string;
  senderIdentityPublicKey?: string;
};

export type SendMessagePayload = {
  chatId: string;
  /** Legacy single-device field — kept for support chats and fallback. */
  ciphertext?: string;
  content?: string;
  ephemeralKey?: string;
  preKeyId?: string;
  senderIdentityPublicKey?: string;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "VOICE_NOTE" | "PAYMENT_REQUEST";
  mediaKey?: string;
  viewOnce?: boolean;
  /** Opaque sender-side correlation id; echoed back unchanged by the server. */
  clientId?: string;
  /**
   * Multi-device envelopes. Key = deviceId, value = per-device ECDH envelope.
   * When present, each device extracts its own entry on receipt.
   */
  deviceCiphertexts?: Record<string, DeviceCiphertext>;
};

export const listChats = () => api.get("/api/v1/chats");

export const getOrCreateChat = (userId: string) =>
  api.post(`/api/v1/chats/${userId}`);

export const getChat = (chatId: string) =>
  api.get(`/api/v1/chats/${chatId}`);

export const sendChatMessage = (payload: SendMessagePayload) =>
  api.post("/api/v1/chats/messages", payload);

export const getChatMessages = (chatId: string, page = 0, size = 20) =>
  api.get(`/api/v1/chats/${chatId}/messages?page=${page}&size=${size}`);

export const markChatRead = (chatId: string) =>
  api.put(`/api/v1/chats/${chatId}/read`);

export const markChatDelivered = (chatId: string) =>
  api.put(`/api/v1/chats/${chatId}/delivered`);

export const sendChatTypingIndicator = (chatId: string, isTyping: boolean) =>
  api.post("/api/v1/chats/typing", { chatId, isTyping });

export const deleteChatMessage = (messageId: string) =>
  api.delete(`/api/v1/chats/messages/${messageId}`);

export const muteChat = (chatId: string, mute: boolean) =>
  api.put(`/api/v1/chats/${chatId}/mute?mute=${mute}`);

export const archiveChat = (chatId: string, archive: boolean) =>
  api.put(`/api/v1/chats/${chatId}/archive?archive=${archive}`);

export const getTotalUnreadChatCount = () => api.get("/api/v1/chats/unread");

export const setDisappearingMessages = (chatId: string, ttlSeconds: number) =>
  api.put(`/api/v1/chats/${chatId}/disappearing`, { ttlSeconds });

export const notifyChatScreenshot = (chatId: string) =>
  api.post(`/api/v1/chats/${chatId}/screenshot`);

export const markChatMediaViewed = (messageId: string) =>
  api.post(`/api/v1/chats/messages/${messageId}/viewed`);

export const editChatMessage = (messageId: string, ciphertext: string) =>
  api.put(`/api/v1/chats/messages/${messageId}`, { ciphertext });

export const uploadChatMedia = (file: RNFile, chatId: string, type: string, encrypted = false) => {
  const formData = new FormData();
  formData.append("file", file as any);
  formData.append("chatId", chatId);
  formData.append("type", type);
  if (encrypted) formData.append("encrypted", "true");
  return api.post("/api/v1/chats/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/**
 * Encrypt a local media file end-to-end, then upload the opaque blob.
 *
 * Returns the Cloudinary URL (`mediaKey`) of the ciphertext and the base64
 * per-file key. The key must be placed inside the message's E2EE envelope
 * (chatStore.sendMedia) — never stored or sent alongside the blob.
 */
export const encryptAndUploadMedia = async (
  localUri: string,
  chatId: string,
  type: string,
): Promise<{ mediaKey: string; fileKeyB64: string }> => {
  const b64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { blob, key } = encryptMedia(base64ToBytes(b64));

  // RN multipart needs a file URI, so stage the blob in the cache dir.
  const tempPath = `${FileSystem.cacheDirectory ?? ""}enc_${Date.now()}_${Math.random().toString(36).slice(2)}.enc`;
  await FileSystem.writeAsStringAsync(tempPath, bytesToBase64(blob), {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    const file: RNFile = { uri: tempPath, name: "media.enc", type: "application/octet-stream" };
    const res = await uploadChatMedia(file, chatId, type, true);
    const mediaKey: string | undefined = res.data?.data?.mediaKey;
    if (!mediaKey) throw new Error("No mediaKey in upload response");
    return { mediaKey, fileKeyB64: bytesToBase64(key) };
  } finally {
    FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  }
};

// --- E2EE Key Bundle Endpoints ---

export type KeyBundleUpload = {
  deviceId: string;
  identityPublicKey: string;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
};

export const uploadKeyBundle = (bundle: KeyBundleUpload) =>
  api.put("/api/v1/users/me/key-bundle", bundle);

/** Fetch a single device bundle (backward-compat, pops one OPK). */
export const fetchUserKeyBundle = (userId: string) =>
  api.get(`/api/v1/users/${userId}/key-bundle`);

/** Fetch ALL device bundles for a recipient, one OPK popped per device. */
export const fetchUserKeyBundles = (userId: string) =>
  api.get(`/api/v1/users/${userId}/key-bundles`);

/** Fetch the authenticated user's own device bundles (no OPK consumed). */
export const fetchOwnKeyBundles = () =>
  api.get("/api/v1/users/me/key-bundles/own");

export const replenishOneTimePreKeys = (
  deviceId: string,
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>,
) => api.post("/api/v1/users/me/one-time-prekeys", { deviceId, oneTimePreKeys });

export const getKeyBundleStatus = () =>
  api.get("/api/v1/users/me/key-bundle/status");

// --- Chat History Sync (device-to-device transfer + encrypted backup) ---
// Every payload is encrypted client-side; the server relays opaque blobs.

export const requestHistoryTransfer = (deviceId: string) =>
  api.post("/api/v1/chats/sync/transfers", { deviceId });

export const getPendingHistoryTransfers = (deviceId: string) =>
  api.get(`/api/v1/chats/sync/transfers/pending?deviceId=${encodeURIComponent(deviceId)}`);

export const getHistoryTransfer = (transferId: string) =>
  api.get(`/api/v1/chats/sync/transfers/${transferId}`);

export const acceptHistoryTransfer = (transferId: string, deviceId: string) =>
  api.post(`/api/v1/chats/sync/transfers/${transferId}/accept`, { deviceId });

export const declineHistoryTransfer = (transferId: string) =>
  api.post(`/api/v1/chats/sync/transfers/${transferId}/decline`);

export const uploadHistoryTransferChunk = (
  transferId: string, deviceId: string, seq: number, payload: string,
) => api.put(`/api/v1/chats/sync/transfers/${transferId}/chunks`, { deviceId, seq, payload });

export const completeHistoryTransfer = (
  transferId: string, deviceId: string, chunkCount: number,
) => api.post(`/api/v1/chats/sync/transfers/${transferId}/complete`, { deviceId, chunkCount });

export const downloadHistoryTransferChunk = (
  transferId: string, deviceId: string, seq: number,
) => api.get(`/api/v1/chats/sync/transfers/${transferId}/chunks/${seq}?deviceId=${encodeURIComponent(deviceId)}`);

export const ackHistoryTransfer = (transferId: string, deviceId: string) =>
  api.post(`/api/v1/chats/sync/transfers/${transferId}/ack`, { deviceId });

export const beginChatBackup = () =>
  api.post("/api/v1/chats/sync/backup/begin");

export const uploadChatBackupChunk = (backupId: string, seq: number, payload: string) =>
  api.put(`/api/v1/chats/sync/backup/${backupId}/chunks`, { seq, payload });

export const completeChatBackup = (backupId: string, chunkCount: number) =>
  api.post(`/api/v1/chats/sync/backup/${backupId}/complete`, { chunkCount });

export const getChatBackupMeta = () =>
  api.get("/api/v1/chats/sync/backup");

export const downloadChatBackupChunk = (backupId: string, seq: number) =>
  api.get(`/api/v1/chats/sync/backup/${backupId}/chunks/${seq}`);

export const deleteChatBackup = () =>
  api.delete("/api/v1/chats/sync/backup");

// In-memory queue for requests that fail while refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach access token + device fingerprint headers
api.interceptors.request.use(
  async (config) => {
    const [token, deviceId, bypassToken] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      getDeviceId(),
      SecureStore.getItemAsync(BYPASS_TOKEN_KEY),
    ]);
    if (config.headers) {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      // These headers drive per-device rate limiting on the backend
      config.headers["X-Device-ID"] = deviceId;
      config.headers["X-Platform"] = Platform.OS; // "ios" | "android"
      if (bypassToken) config.headers["X-Bypass-Token"] = bypassToken;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401s, 429s, 503s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const sanitizeMessage = (msg: any, status?: number) => {
      if (typeof msg !== 'string') return msg;
      let clean = msg.replace(/^(\[?[A-Za-z0-9_]+\]?)\s*[:\-]\s*/, "");
      
      // Hide raw HTTP status codes from the UI
      if (clean.includes("status code")) {
        if (status === 401) return "Session expired or invalid credentials.";
        if (status === 403) return "Access denied.";
        if (status === 404) return "Resource not found.";
        if (status === 429) return "Too many requests. Please try again later.";
        if (status && status >= 500) return "Our servers are experiencing issues. Please try again later.";
        return "An unexpected network error occurred.";
      }
      return clean;
    };

    if (error.response?.data?.message) {
      error.response.data.message = sanitizeMessage(error.response.data.message, error.response?.status);
    }
    if (error.response?.data?.error) {
      error.response.data.error = sanitizeMessage(error.response.data.error, error.response?.status);
    }
    if (error.message) {
      error.message = sanitizeMessage(error.message, error.response?.status);
    }

    const originalRequest = error.config;

    // 429 — rate limited. Attach metadata so callers can show a countdown or CAPTCHA prompt.
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      const challengeAvailable =
        error.response.headers["x-challenge-available"] === "true";
      error.isRateLimited = true;
      error.retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      error.challengeAvailable = challengeAvailable;
      return Promise.reject(error);
    }

    // 503 — server queue full (async backpressure). Callers should retry after a short delay.
    if (error.response?.status === 503) {
      error.isServiceBusy = true;
      error.retryAfterSeconds = 5;
      return Promise.reject(error);
    }

    // If 401 and we haven't already retried this exact request
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept 401s on login, 2fa, biometric, or refresh endpoints
      const isLoginOrRefresh =
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/biometric-login") ||
        originalRequest.url?.includes("/auth/2fa/login") ||
        originalRequest.url?.includes("/auth/refresh");

      if (isLoginOrRefresh) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request until the refresh is done
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // Call refresh endpoint directly using axios to avoid looping
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data?.accessToken || data.accessToken;
        const newRefreshToken = data.data?.refreshToken || data.refreshToken;

        if (newAccessToken && newRefreshToken) {
          await SecureStore.setItemAsync(TOKEN_KEY, newAccessToken);
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);

          api.defaults.headers.common["Authorization"] =
            `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // Notify long-lived WebSocket connections that the access token
          // has rotated, so they can reconnect with the new credential
          // before the broker drops them.
          emitAuthEvent({ type: 'tokenRotated', accessToken: newAccessToken });

          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error("Invalid refresh response payload");
        }
      } catch (err) {
        processQueue(err, null);

        // If refresh fails, clear tokens. We will rely on Zustand store to catch this or trigger logout.
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        if (onAuthFailure) onAuthFailure();
        _forceLogout?.();

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 (Forbidden)
    if (error.response?.status === 403) {
      const responseData = error.response?.data;
      const isCloudflareHtmlBlock = typeof responseData === 'string' && 
        responseData.toLowerCase().includes('cloudflare');

      // Geo-blocked — navigate to the "not available in your region" screen.
      if (responseData?.error === 'GEO_RESTRICTED' || isCloudflareHtmlBlock) {
        emitAuthEvent({ type: 'geoBlocked' });
        return Promise.reject(error);
      }
      // Token is revoked or session is invalid — clear tokens and trigger logout.
      if (!originalRequest.url?.includes('/auth/')) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        _forceLogout?.();
      }
    }

    return Promise.reject(error);
  },
);

// --- Recurring Transfers ---

export const getRecurringTransfers = () => api.get('/api/v1/recurring-transfers');
export const createRecurringTransfer = (data: { recipientIdentifier: string; amount: number; note?: string; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; startDate: string }) => api.post('/api/v1/recurring-transfers', data);
export const pauseRecurringTransfer = (id: string) => api.put(`/api/v1/recurring-transfers/${id}/pause`);
export const resumeRecurringTransfer = (id: string) => api.put(`/api/v1/recurring-transfers/${id}/resume`);
export const cancelRecurringTransfer = (id: string) => api.delete(`/api/v1/recurring-transfers/${id}`);

// --- Bulk Transfer ---

export const bulkTransfer = (data: { transfers: { recipientIdentifier: string; amount: number; note?: string }[] }) => api.post('/api/v1/transfers/bulk', data);

// --- Transaction Search ---

export const searchTransactions = (params: { q?: string; status?: string; type?: string; direction?: string; minAmount?: number; maxAmount?: number; startDate?: string; endDate?: string; page?: number; size?: number }) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
  return api.get(`/api/v1/transfers/search?${p}`);
};

// --- Spending Categories ---

export const getSpendingCategories = (startDate: string, endDate: string) => api.get(`/api/v1/wallet/spending/categories?startDate=${startDate}&endDate=${endDate}`);

// --- Wallet Freeze ---

export const getWalletStatus = () => api.get('/api/v1/users/me/wallet/status');
export const freezeWallet = () => api.post('/api/v1/users/me/wallet/freeze');
export const unfreezeWallet = () => api.post('/api/v1/users/me/wallet/unfreeze');

// --- Financial Summary ---

export const getFinancialSummary = (startDate: string, endDate: string) =>
  api.get(`/api/v1/wallet/financial-summary?startDate=${startDate}&endDate=${endDate}`);

// --- Budget Management ---

export const getBudgets = () => api.get('/api/v1/budgets');

export const createOrUpdateBudget = (data: { category: string; budgetAmount: number; period?: string }) =>
  api.post('/api/v1/budgets', data);

export const deleteBudget = (id: string) => api.delete(`/api/v1/budgets/${id}`);

export const getBudgetStatus = (startDate: string, endDate: string) =>
  api.get(`/api/v1/budgets/status?startDate=${startDate}&endDate=${endDate}`);

export const getTransactionInsight = (transactionId: string) =>
  api.post('/api/v1/ai/insight', { transactionId });

export const sendAiMessage = (message: string, history: { role: string; content: string }[]) =>
  api.post('/api/v1/ai/chat', { message, history });

export const getChatbaseToken = () =>
  api.get<{ success: boolean; data: { token: string } }>('/api/v1/ai/chatbase-token');

export const checkTransferAnomaly = (recipientIdentifier: string, amount: number) =>
  api.post('/api/v1/transfers/check-anomaly', { recipientIdentifier, amount });

export const suggestTransferCategory = (recipientIdentifier: string, note: string) =>
  api.post('/api/v1/transfers/suggest-category', { recipientIdentifier, note });

export const authorizeQrLogin = (challengeToken: string) =>
  api.post('/api/v1/auth/qr-login/authorize', { challengeToken });

export const fetchOAuthClientInfo = (clientId: string) =>
  api.get(`/oauth/clients/${clientId}`).then(r => r.data?.data as {
    clientId: string;
    appName: string;
    appDescription?: string;
    logoUrl?: string;
    websiteUrl?: string;
    allowedScopes: string[];
  });

// ── Developer OAuth client management ─────────────────────────────────────────
export const getDeveloperClients = () => api.get('/api/v1/developer/clients');
export const registerDeveloperClient = (data: {
  appName: string;
  appDescription?: string;
  logoUrl?: string;
  websiteUrl?: string;
  redirectUris: string[];
  scopes: string[];
}) => api.post('/api/v1/developer/clients', data);
export const getDeveloperClient = (clientId: string) =>
  api.get(`/api/v1/developer/clients/${clientId}`);
export const rotateDeveloperClientSecret = (clientId: string) =>
  api.post(`/api/v1/developer/clients/${clientId}/rotate-secret`);
export const deleteDeveloperClient = (clientId: string) =>
  api.delete(`/api/v1/developer/clients/${clientId}`);

export const linkMerchantToOAuthClient = (clientId: string) =>
  api.post(`/api/v1/developer/clients/${clientId}/merchant`);

export const unlinkMerchantFromOAuthClient = (clientId: string) =>
  api.delete(`/api/v1/developer/clients/${clientId}/merchant`);

// ── Connected apps (user side) ────────────────────────────────────────────────
export const getConnectedApps = () => api.get('/oauth/connected-apps');
export const revokeConnectedApp = (clientId: string) =>
  api.delete(`/oauth/connected-apps/${clientId}`);

// ── Unsplash image search ──────────────────────────────────────────────────────
export type UnsplashPhoto = {
  id: string;
  thumbUrl: string;
  regularUrl: string;
  photographerName: string;
  photographerUrl: string;
  downloadLocation: string;
};

export const getMerchantAnalytics = (days = 30) =>
  api.get(`/api/v1/merchant/analytics?days=${days}`);

export const searchUnsplash = (query: string, page = 1) =>
  api.get<{ success: boolean; data: UnsplashPhoto[] }>('/api/v1/unsplash/search', {
    params: { query, page, perPage: 20 },
  });

export const triggerUnsplashDownload = (downloadLocation: string) =>
  api.post('/api/v1/unsplash/trigger-download', { downloadLocation });
