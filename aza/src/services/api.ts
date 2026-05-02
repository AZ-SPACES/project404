import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const getBaseUrl = (): string => {
  const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];

  if (metroHost) {
    return `http://${metroHost}:8080`;
  }

  // Fallback for emulators when no Metro host is available
  return Platform.OS === "android"
    ? "http://10.0.2.2:8080"
    : "http://localhost:8080";
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

let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (cb: () => void) => {
  onAuthFailure = cb;
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

export const totpLogin = (preAuthToken: string, code: string) =>
  api.post("/api/v1/auth/2fa/login", { preAuthToken, code });

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
) => api.post("/api/v1/kyc/pep-screening", { isPep, pepStatus, pepRole });

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

export const checkHandleAvailability = (handle: string) =>
  api.get(`/api/v1/users/check-handle?handle=${encodeURIComponent(handle)}`);

export const suggestHandles = (firstName: string, lastName: string) =>
  api.get(
    `/api/v1/users/suggest-handles?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`,
  );

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

// --- Security & Privacy Endpoints ---

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post("/api/v1/auth/change-password", { currentPassword, newPassword });

export const forgotPassword = (identifier: string) =>
  api.post("/api/v1/auth/forgot-password", { identifier });

export const resetPassword = (identifier: string, code: string, newPassword: string) =>
  api.post("/api/v1/auth/reset-password", { identifier, code, newPassword });

export const verifyOtp = (identifier: string, code: string, purpose: string) =>
  api.post("/api/v1/auth/verify-otp", { identifier, code, purpose });

export const logoutEverywhere = () =>
  api.post("/api/v1/auth/logout-everywhere");

export const secureAccount = () =>
  api.post("/api/v1/auth/secure-account");

export const getDevices = () => api.get("/api/v1/users/me/devices");

export const removeSelfEverywhere = () =>
  api.delete("/api/v1/users/me/privacy");

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

export const setup2FA = () => api.post("/api/v1/auth/2fa/setup");

export const confirm2FA = (code: string) =>
  api.post("/api/v1/auth/2fa/confirm", { code });

export const disable2FA = (code: string) =>
  api.delete("/api/v1/auth/2fa", { data: { code } });

export const regenerateRecoveryCodes = (code: string) =>
  api.post("/api/v1/auth/2fa/recovery/regenerate", { code });


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

// Request Interceptor: Attach access token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401s and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried this exact request
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept 401s on the login or refresh endpoints themselves
      if (
        originalRequest.url.includes("/auth/login") ||
        originalRequest.url.includes("/auth/refresh")
      ) {
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

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
