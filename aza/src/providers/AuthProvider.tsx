import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

type AuthState = {
  userToken: string | null;
  isKYCVerified: boolean;
  hasPasscode: boolean;
  isBiometricsEnabled: boolean;
  isLoading: boolean;
};

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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STATE_KEY = "aza_auth_state";
const PASSCODE_VALUE_KEY = "aza_passcode";

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
    saveState({ userToken: null, isKYCVerified: false, hasPasscode: false });
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
