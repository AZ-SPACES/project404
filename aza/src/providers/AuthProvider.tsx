import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setForceLogoutHandler, getKycStatus, logout as apiLogout } from "../services/api";
import { emitAuthEvent } from "./authEvents";
import { queryClient } from "../lib/queryClient";
import { beginAccountSession, endAccountSession } from "../store/accountSession";
import { purgeLegacyGlobalStorage } from "../store/legacyStorageCleanup";

type AuthState = {
  userToken: string | null;
  /**
   * The signed-in user's id, once known. Persisted alongside the token so a
   * cold launch can open the account session — and hydrate account-scoped
   * stores like drafts — without waiting on a network round trip.
   */
  userId: string | null;
  isKYCVerified: boolean;
  hasPasscode: boolean;
  isBiometricsEnabled: boolean;
  forcePasswordReset: boolean;
  requireSelfieVerification: boolean;
  scheduledDeletionAt: string | null;
  isLoading: boolean;
};

/** Named-parameter bag for the login() action. All fields except `token` are optional. */
export type LoginSession = {
  token: string;
  userId?: string | null;
  hasPasscode?: boolean;
  isKYCVerified?: boolean;
  forcePasswordReset?: boolean;
  requireSelfieVerification?: boolean;
  isBiometricsEnabled?: boolean;
  scheduledDeletionAt?: string | null;
};

type PinLockoutResult = { isLocked: boolean; secondsRemaining: number };

type AuthContextType = AuthState & {
  login: (session: LoginSession) => void;
  logout: () => void;
  /**
   * Record the signed-in user's id once resolved, and open the account session
   * so account-scoped stores hydrate. Called by E2EEProvider, which resolves it
   * during identity bootstrap.
   */
  setUserId: (userId: string) => void;
  completeKYC: () => void;
  setPasscode: () => void;
  toggleBiometrics: (enabled: boolean) => void;
  savePasscodeValue: (code: string) => Promise<void>;
  getPasscodeValue: () => Promise<string | null>;
  verifyPasscode: (code: string) => Promise<boolean>;
  checkPinLockout: () => Promise<PinLockoutResult>;
  recordPinFailure: () => Promise<PinLockoutResult>;
  resetPinAttempts: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STATE_KEY = "aza_auth_state";
const PIN_ATTEMPTS_KEY = "aza_pin_attempts";
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

type PinAttemptState = { count: number; lockedUntil: number | null };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    userToken: null,
    userId: null,
    isKYCVerified: false,
    hasPasscode: false,
    isBiometricsEnabled: false,
    forcePasswordReset: false,
    requireSelfieVerification: false,
    scheduledDeletionAt: null,
    isLoading: true,
  });


  // Ref tracks the latest state — including updates React has queued but not
  // yet rendered — so async SecureStore writes always persist the most recent
  // version. Every write goes through applyState so the two never diverge.
  const stateRef = useRef(authState);

  const applyState = useCallback((next: AuthState) => {
    stateRef.current = next;
    setAuthState(next);
  }, []);

  useEffect(() => {
    const bootstrapAsync = async () => {
      // Erase the pre-account-scoping AsyncStorage keys — including the ones
      // that held plaintext message content device-globally — before anything
      // reads storage. Guarded internally, so this is a no-op after the first
      // launch on this install.
      await purgeLegacyGlobalStorage();

      let stateFromStorage: AuthState | null = null;
      try {
        const storedState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
        if (storedState) {
          stateFromStorage = JSON.parse(storedState);
        }
      } catch (e) {
        console.error("Failed to load auth state", e);
      }

      let hasPasscodeResolved = stateFromStorage?.hasPasscode || false;

      // If the user has a token but isKYCVerified is false locally, check the
      // backend before rendering — this prevents routing to KYC when the admin
      // approved while the app was closed or the push was missed.
      let isKYCVerifiedResolved = stateFromStorage?.isKYCVerified || false;
      if (stateFromStorage?.userToken && !isKYCVerifiedResolved) {
        try {
          const res = await getKycStatus();
          if (res.data?.data?.status === 'VERIFIED') {
            isKYCVerifiedResolved = true;
            await SecureStore.setItemAsync(
              AUTH_STATE_KEY,
              JSON.stringify({ ...stateFromStorage, isKYCVerified: true }),
            );
          }
        } catch (_) {}
      }

      // Open the account session before rendering, so account-scoped stores
      // hydrate from the right namespace rather than starting empty and
      // popping in. A launch with a token but no stored id (upgraded from a
      // build that predates it) waits for E2EEProvider to resolve one.
      if (stateFromStorage?.userToken && stateFromStorage?.userId) {
        await beginAccountSession(stateFromStorage.userId);
      }

      applyState({
        userToken: stateFromStorage?.userToken || null,
        userId: stateFromStorage?.userId || null,
        isKYCVerified: isKYCVerifiedResolved,
        hasPasscode: hasPasscodeResolved,
        isBiometricsEnabled: stateFromStorage?.isBiometricsEnabled || false,
        forcePasswordReset: stateFromStorage?.forcePasswordReset || false,
        requireSelfieVerification: stateFromStorage?.requireSelfieVerification || false,
        scheduledDeletionAt: stateFromStorage?.scheduledDeletionAt || null,
        isLoading: false,
      });
    };

    bootstrapAsync();
  }, [applyState]);

  const saveState = useCallback(async (newState: Partial<AuthState>) => {
    // Merge off the ref rather than React's `prev`. React only computes an
    // updater eagerly for the first update in a queue, so reading the ref
    // after a `setAuthState(fn)` could hand us pre-merge values and persist
    // them — state that looked right in-session but was wrong on next launch.
    // The ref is written synchronously here, so back-to-back calls compose.
    const toPersist = { ...stateRef.current, ...newState };
    applyState(toPersist);
    try {
      await SecureStore.setItemAsync(
        AUTH_STATE_KEY,
        JSON.stringify(toPersist),
      );
    } catch (e) {
      console.error("Failed to save auth state", e);
      Alert.alert(
        "Session Error",
        "We couldn't save your session. Please restart the app if issues persist.",
      );
    }
  }, [applyState]);

  const login = useCallback(({
    token,
    userId = null,
    hasPasscode = false,
    isKYCVerified = false,
    forcePasswordReset = false,
    requireSelfieVerification = false,
    isBiometricsEnabled = false,
    scheduledDeletionAt = null,
  }: LoginSession) => {
    if (userId) void beginAccountSession(userId);
    saveState({
      userToken: token,
      userId,
      hasPasscode,
      isKYCVerified,
      forcePasswordReset,
      requireSelfieVerification,
      isBiometricsEnabled,
      scheduledDeletionAt: scheduledDeletionAt ?? null,
    });
  }, [saveState]);

  const setUserId = useCallback((userId: string) => {
    if (stateRef.current.userId === userId) return;
    void beginAccountSession(userId);
    saveState({ userId });
  }, [saveState]);

  const logout = useCallback(() => {
    // Reset in-memory state immediately so navigation reacts at once
    applyState({
      userToken: null,
      userId: null,
      isKYCVerified: false,
      hasPasscode: false,
      isBiometricsEnabled: false,
      forcePasswordReset: false,
      requireSelfieVerification: false,
      scheduledDeletionAt: null,
      isLoading: false,
    });
    // Close the account session before anything else. This nulls the account
    // id that `accountStorage` keys off, so from here on no account-scoped
    // store can read or write disk — a screen still mounted during teardown
    // can't write the outgoing user's data back after the wipe — and then
    // erases every account-scoped slice.
    void endAccountSession();
    // Wipe all server-state cache so stale data never bleeds into the next session
    queryClient.clear();
    // Fan out to providers that hold sensitive in-memory state (E2EE identity,
    // chat caches, peer key cache) so they can wipe.
    emitAuthEvent({ type: 'logout' });
    // Invalidate the session token on the server and clear local secrets.
    // apiLogout is fire-and-forget — local state is already cleared above.
    Promise.all([
      apiLogout().catch(() => {}),
      SecureStore.deleteItemAsync(AUTH_STATE_KEY),
      SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY),
    ]).catch((e) => console.error("Failed to clear SecureStore on logout", e));
  }, [applyState]);

  // Register logout with the API interceptor so that 403 responses
  // (token revoked / invalid) automatically clear the session.
  useEffect(() => {
    setForceLogoutHandler(logout);
  }, [logout]);

  const completeKYC = useCallback(() => {
    saveState({ isKYCVerified: true });
  }, [saveState]);

  const setPasscode = useCallback(() => {
    saveState({ hasPasscode: true });
  }, [saveState]);

  const getPasscodeValue = useCallback(async (): Promise<string | null> => {
    return null; // Disabled: we no longer store passcodes locally
  }, []);

  const savePasscodeValue = useCallback(async (code: string): Promise<void> => {
    // Disabled: we no longer store passcodes locally
  }, []);

  const verifyPasscode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const { api } = await import("../services/api");
      const response = await api.post("/api/v1/auth/passcode/verify", { passcode: code });
      return response.status === 200 || response.status === 201;
    } catch (e) {
      console.error("Failed to verify passcode", e);
      return false;
    }
  }, []);

  const checkPinLockout = useCallback(async (): Promise<PinLockoutResult> => {
    try {
      const raw = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
      if (!raw) return { isLocked: false, secondsRemaining: 0 };
      const state: PinAttemptState = JSON.parse(raw);
      if (!state.lockedUntil) return { isLocked: false, secondsRemaining: 0 };
      const remaining = state.lockedUntil - Date.now();
      if (remaining <= 0) {
        await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
        return { isLocked: false, secondsRemaining: 0 };
      }
      return { isLocked: true, secondsRemaining: Math.ceil(remaining / 1000) };
    } catch {
      return { isLocked: false, secondsRemaining: 0 };
    }
  }, []);

  const recordPinFailure = useCallback(async (): Promise<PinLockoutResult> => {
    try {
      const raw = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
      const current: PinAttemptState = raw
        ? JSON.parse(raw)
        : { count: 0, lockedUntil: null };
      const newCount = current.count + 1;
      const lockedUntil =
        newCount >= MAX_PIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
      await SecureStore.setItemAsync(
        PIN_ATTEMPTS_KEY,
        JSON.stringify({ count: newCount, lockedUntil }),
      );
      if (lockedUntil) {
        return {
          isLocked: true,
          secondsRemaining: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        };
      }
      return { isLocked: false, secondsRemaining: 0 };
    } catch {
      return { isLocked: false, secondsRemaining: 0 };
    }
  }, []);

  const resetPinAttempts = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
    } catch (e) {
      console.error("Failed to reset PIN attempts", e);
    }
  }, []);

  const toggleBiometrics = useCallback(async (enabled: boolean) => {
    saveState({ isBiometricsEnabled: enabled });
    try {
      const { updatePrivacySettings } = await import("../services/api");
      await updatePrivacySettings({ biometricsEnabled: enabled });
    } catch (e) {
      console.error("Failed to sync biometrics setting to backend", e);
    }
  }, [saveState]);

  // Memoised: this provider wraps the whole app and `useAuth` has ~29 call
  // sites, so handing out a fresh object each render re-rendered all of them
  // whenever anything above changed. Every action below is a stable
  // useCallback, so this only changes when auth state actually does.
  const value = useMemo<AuthContextType>(
    () => ({
      ...authState,
      login,
      logout,
      setUserId,
      completeKYC,
      setPasscode,
      toggleBiometrics,
      savePasscodeValue,
      getPasscodeValue,
      verifyPasscode,
      checkPinLockout,
      recordPinFailure,
      resetPinAttempts,
    }),
    [
      authState,
      login,
      logout,
      setUserId,
      completeKYC,
      setPasscode,
      toggleBiometrics,
      savePasscodeValue,
      getPasscodeValue,
      verifyPasscode,
      checkPinLockout,
      recordPinFailure,
      resetPinAttempts,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
