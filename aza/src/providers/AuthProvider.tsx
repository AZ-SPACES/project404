import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

type AuthState = {
  userToken: string | null;
  isKYCVerified: boolean;
  hasPasscode: boolean;
  isBiometricsEnabled: boolean;
  isLoading: boolean;
};

type PinLockoutResult = { isLocked: boolean; secondsRemaining: number };

type AuthContextType = AuthState & {
  login: (
    token: string,
    hasPasscodeArg?: boolean,
    isKYCVerifiedArg?: boolean,
  ) => void;
  logout: () => void;
  completeKYC: () => void;
  setPasscode: () => void;
  toggleBiometrics: (enabled: boolean) => void;
  savePasscodeValue: (code: string) => Promise<void>;
  verifyPasscode: (code: string) => Promise<boolean>;
  checkPinLockout: () => Promise<PinLockoutResult>;
  recordPinFailure: () => Promise<PinLockoutResult>;
  resetPinAttempts: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STATE_KEY = "aza_auth_state";
const PASSCODE_VALUE_KEY = "aza_passcode";
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
        // Restoring state failed
        console.error("Failed to load auth state", e);
      }

      setAuthState({
        userToken: stateFromStorage?.userToken || null,
        isKYCVerified: stateFromStorage?.isKYCVerified || false,
        hasPasscode: stateFromStorage?.hasPasscode || false,
        isBiometricsEnabled: stateFromStorage?.isBiometricsEnabled || false,
        isLoading: false,
      });
    };

    bootstrapAsync();
  }, []);

  const saveState = async (newState: Partial<AuthState>) => {
    const updatedState = { ...authState, ...newState };
    setAuthState(updatedState);
    try {
      await SecureStore.setItemAsync(AUTH_STATE_KEY, JSON.stringify(updatedState));
    } catch (e) {
      console.error("Failed to save auth state", e);
    }
  };

  const login = (
    token: string,
    hasPasscodeArg: boolean = false,
    isKYCVerifiedArg: boolean = false,
  ) => {
    saveState({
      userToken: token,
      hasPasscode: hasPasscodeArg,
      isKYCVerified: isKYCVerifiedArg,
    });
  };

  const logout = () => {
    // Reset in-memory state immediately so navigation reacts at once
    setAuthState({
      userToken: null,
      isKYCVerified: false,
      hasPasscode: false,
      isBiometricsEnabled: false,
      isLoading: false,
    });
    // Clear all persisted secrets in the background
    Promise.all([
      SecureStore.deleteItemAsync(AUTH_STATE_KEY),
      SecureStore.deleteItemAsync(PASSCODE_VALUE_KEY),
      SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY),
    ]).catch((e) => console.error("Failed to clear SecureStore on logout", e));
  };

  const completeKYC = () => {
    saveState({ isKYCVerified: true });
  };

  const setPasscode = () => {
    saveState({ hasPasscode: true });
  };

  const savePasscodeValue = useCallback(async (code: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(PASSCODE_VALUE_KEY, code);
    } catch (e) {
      console.error("Failed to save passcode value", e);
    }
    saveState({ hasPasscode: true });
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
      const current: PinAttemptState = raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
      const newCount = current.count + 1;
      const lockedUntil = newCount >= MAX_PIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
      await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, JSON.stringify({ count: newCount, lockedUntil }));
      if (lockedUntil) {
        return { isLocked: true, secondsRemaining: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
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

  const toggleBiometrics = (enabled: boolean) => {
    saveState({ isBiometricsEnabled: enabled });
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
