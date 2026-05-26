import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

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
  const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
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
  frontImage: any,
  backImage: any,
) => {
  const formData = new FormData();
  formData.append("idType", idType);
  formData.append("idNumber", idNumber);
  formData.append("frontImage", frontImage);
  formData.append("backImage", backImage);

  return api.post("/api/v1/kyc/identity", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const submitSelfie = (selfie: any) => {
  const formData = new FormData();
  formData.append("selfie", selfie);

  return api.post("/api/v1/kyc/selfie", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
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

export const submitProofOfWealth = (document: any) => {
  const formData = new FormData();
  formData.append("document", document);

  return api.post("/api/v1/kyc/proof-of-wealth", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const submitKycFinal = () => api.post("/api/v1/kyc/submit");

// --- User Endpoints ---

export const getMe = () => api.get("/api/v1/users/me");

export const updateMe = (data: any) => api.put("/api/v1/users/me", data);

export const uploadProfileImage = (file: any) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.put("/api/v1/users/me/profile-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const uploadHomeBackground = (file: any) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.put("/api/v1/users/me/home-background", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const uploadHubBackground = (file: any) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.put("/api/v1/users/me/hub-background", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
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

// --- Support Endpoints ---

export const getOrCreateSupportChat = () => api.post("/api/v1/support/chat");

export const getSupportMessages = (page = 0, size = 50) =>
  api.get(`/api/v1/support/chat/messages?page=${page}&size=${size}&_t=${Date.now()}`);

export const sendSupportMessage = (content: string) =>
  api.post("/api/v1/support/chat/message", { content });

export const getAvailableSupportAgents = () =>
  api.get("/api/v1/support/agents/available");

export const initiateCall = (calleeId: string, type: "VOICE" | "VIDEO") =>
  api.post("/api/v1/calls", { calleeId, type });

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

export const getTransactions = (page = 0, size = 20, type?: string, status?: string) =>
  api.get(`/api/v1/transfers?page=${page}&size=${size}${type ? `&type=${type}` : ""}${status ? `&status=${status}` : ""}`);

export const getTransactionsStatement = (startDate: string, endDate: string) =>
  api.get(`/api/v1/transfers/statement?startDate=${startDate}&endDate=${endDate}`, {
    responseType: "blob",
  });

export const sendTransactionsStatementEmail = (startDate: string, endDate: string) =>
  api.post(`/api/v1/transfers/statement/email?startDate=${startDate}&endDate=${endDate}`);

// --- Security & Privacy Endpoints ---

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post("/api/v1/auth/change-password", { currentPassword, newPassword });

export const forgotPassword = (identifier: string) =>
  api.post("/api/v1/auth/forgot-password", { identifier });

export const resetPassword = (identifier: string, code: string, newPassword: string) =>
  api.post("/api/v1/auth/reset-password", { identifier, code, newPassword });

export const verifyOtp = (identifier: string, code: string, purpose: string, deviceName?: string, deviceOs?: string, deviceId?: string) =>
  api.post("/api/v1/auth/verify-otp", { identifier, code, purpose, deviceName, deviceOs, deviceId });

export const logoutEverywhere = () =>
  api.post("/api/v1/auth/logout-everywhere");

export const secureAccount = () =>
  api.post("/api/v1/auth/secure-account");

export const getDevices = () => api.get("/api/v1/users/me/devices");

export const removeSelfEverywhere = () =>
  api.delete("/api/v1/users/me/privacy");

export const deleteAccount = () =>
  api.delete("/api/v1/users/me");

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

// --- 2FA / TOTP Endpoints ---

export const initiateTotpSetup = () => api.post("/api/v1/auth/2fa/setup");

export const confirmTotpSetup = (code: string) =>
  api.post("/api/v1/auth/2fa/confirm", { code });

export const disableTotp = (code: string) =>
  api.delete("/api/v1/auth/2fa", { data: { code } });

export const regenerateRecoveryCodes = (code: string) =>
  api.post("/api/v1/auth/2fa/recovery/regenerate", { code });

export const redeemRecoveryCode = (preAuthToken: string, recoveryCode: string) =>
  api.post("/api/v1/auth/2fa/recovery", { preAuthToken, recoveryCode });

export const requestApp2faApproval = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/app/request?preAuthToken=${preAuthToken}`);

export const checkApp2faStatus = (preAuthToken: string, requestId: string) =>
  api.post(`/api/v1/auth/2fa/app/status?preAuthToken=${preAuthToken}&requestId=${requestId}`);

export const requestSms2fa = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/sms/request?preAuthToken=${preAuthToken}`);

export const requestEmail2fa = (preAuthToken: string) =>
  api.post(`/api/v1/auth/2fa/email/request?preAuthToken=${preAuthToken}`);

export const verify2faOtp = (preAuthToken: string, code: string, method: string) =>
  api.post(`/api/v1/auth/2fa/otp/verify?preAuthToken=${preAuthToken}&code=${code}&method=${method}`);

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

export const uploadMerchantLogo = (file: any) => {
  const formData = new FormData();
  formData.append('file', file);
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

export const uploadKybDocument = (file: any, type: string) => {
  const formData = new FormData();
  formData.append('file', file);
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

export const deleteMerchantWebhook = (endpointId: string) =>
  api.delete(`/api/v1/merchant/webhooks/${endpointId}`);

export const getMerchantPayouts = (page = 0, size = 20) =>
  api.get(`/api/v1/merchant/payouts?page=${page}&size=${size}`);

export const requestMerchantPayout = (amount: number, passcode: string) =>
  api.post('/api/v1/merchant/payouts', { amount, passcode });

// --- Mini App Endpoints ---

export const reportMiniApp = (appId: string, reason: string, details?: string) =>
  api.post(`/api/v1/miniapps/${appId}/report`, { reason, details });

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
    const sanitizeMessage = (msg: any) => {
      if (typeof msg !== 'string') return msg;
      return msg.replace(/^(\[?[A-Za-z0-9_]+\]?)\s*[:\-]\s*/, "");
    };

    if (error.response?.data?.message) {
      error.response.data.message = sanitizeMessage(error.response.data.message);
    }
    if (error.response?.data?.error) {
      error.response.data.error = sanitizeMessage(error.response.data.error);
    }
    if (error.message) {
      error.message = sanitizeMessage(error.message);
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

    // Handle 403 (Forbidden) — token is revoked or session is invalid.
    // Clear stored tokens and trigger logout so the user is sent back
    // to the login screen instead of being stuck on a broken screen.
    if (error.response?.status === 403) {
      // Don't intercept 403s on auth endpoints
      if (!originalRequest.url?.includes('/auth/')) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        _forceLogout?.();
      }
    }

    return Promise.reject(error);
  },
);
