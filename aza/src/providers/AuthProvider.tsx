import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setForceLogoutHandler, getKycStatus } from "../services/api";

type AuthState = {
  userToken: string | null;
  isKYCVerified: boolean;
  hasPasscode: boolean;
  isBiometricsEnabled: boolean;
  forcePasswordReset: boolean;
  requireSelfieVerification: boolean;
  isLoading: boolean;
};

type PinLockoutResult = { isLocked: boolean; secondsRemaining: number };

type AuthContextType = AuthState & {
  login: (
    token: string,
    hasPasscodeArg?: boolean,
    isKYCVerifiedArg?: boolean,
    forcePasswordReset?: boolean,
    requireSelfieVerification?: boolean,
    isBiometricsEnabled?: boolean,
  ) => void;
  logout: () => void;
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
export const PASSCODE_VALUE_KEY = "aza_passcode";
const PIN_ATTEMPTS_KEY = "aza_pin_attempts";
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

type PinAttemptState = { count: number; lockedUntil: number | null };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    userToken: null,
    isKYCVerified: false,
    hasPasscode: false,
    isBiometricsEnabled: false,
    forcePasswordReset: false,
    requireSelfieVerification: false,
    isLoading: true,
  });


  useEffect(() => {
    const bootstrapAsync = async () => {
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
      if (!hasPasscodeResolved && stateFromStorage?.userToken) {
        try {
          const stored = await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);
          hasPasscodeResolved = stored !== null;
        } catch (_) {}
      }

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

      setAuthState({
        userToken: stateFromStorage?.userToken || null,
        isKYCVerified: isKYCVerifiedResolved,
        hasPasscode: hasPasscodeResolved,
        isBiometricsEnabled: stateFromStorage?.isBiometricsEnabled || false,
        forcePasswordReset: stateFromStorage?.forcePasswordReset || false,
        requireSelfieVerification: stateFromStorage?.requireSelfieVerification || false,
        isLoading: false,
      });
    };

    bootstrapAsync();
  }, []);

  // Ref tracks the latest state so async SecureStore writes always
  // persist the most recent version, avoiding stale-closure overwrites.
  const stateRef = useRef(authState);
  stateRef.current = authState;

  const saveState = useCallback(async (newState: Partial<AuthState>) => {
    setAuthState(prev => {
      const updated = { ...prev, ...newState };
      stateRef.current = updated;
      return updated;
    });
    // Persist using the merged values (ref is updated synchronously above)
    const toPersist = { ...stateRef.current };
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
  }, []);

  const login = useCallback((
    token: string,
    hasPasscodeArg: boolean = false,
    isKYCVerifiedArg: boolean = false,
    forcePasswordResetArg: boolean = false,
    requireSelfieVerificationArg: boolean = false,
    isBiometricsEnabledArg: boolean = false,
  ) => {
    saveState({
      userToken: token,
      hasPasscode: hasPasscodeArg,
      isKYCVerified: isKYCVerifiedArg,
      forcePasswordReset: forcePasswordResetArg,
      requireSelfieVerification: requireSelfieVerificationArg,
      isBiometricsEnabled: isBiometricsEnabledArg,
    });
  }, [saveState]);

  const logout = useCallback(() => {
    // Reset in-memory state immediately so navigation reacts at once
    setAuthState({
      userToken: null,
      isKYCVerified: false,
      hasPasscode: false,
      isBiometricsEnabled: false,
      forcePasswordReset: false,
      requireSelfieVerification: false,
      isLoading: false,
    });
    // Clear all persisted secrets in the background
    Promise.all([
      SecureStore.deleteItemAsync(AUTH_STATE_KEY),
      SecureStore.deleteItemAsync(PASSCODE_VALUE_KEY),
      SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY),
    ]).catch((e) => console.error("Failed to clear SecureStore on logout", e));
  }, []);

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
    try {
      return await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);
    } catch (e) {
      console.error("Failed to read passcode value", e);
      return null;
    }
  }, []);

  const savePasscodeValue = useCallback(async (code: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(PASSCODE_VALUE_KEY, code);
    } catch (e) {
      console.error("Failed to save passcode value", e);
      Alert.alert(
        "Passcode Error",
        "We couldn't save your passcode. Please try again.",
      );
    }
  }, []);

  const verifyPasscode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const stored = await SecureStore.getItemAsync(PASSCODE_VALUE_KEY);
      return stored !== null && stored === code;
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

  const toggleBiometrics = async (enabled: boolean) => {
    saveState({ isBiometricsEnabled: enabled });
    try {
      const { updatePrivacySettings } = await import("../services/api");
      await updatePrivacySettings({ biometricsEnabled: enabled });
    } catch (e) {
      console.error("Failed to sync biometrics setting to backend", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        completeKYC,
        setPasscode,
        toggleBiometrics,
        savePasscodeValue,
        getPasscodeValue,
        verifyPasscode,
        checkPinLockout,
        recordPinFailure,
        resetPinAttempts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
