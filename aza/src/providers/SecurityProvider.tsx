import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from './AuthProvider';

const SECURITY_STORAGE_KEY = 'aza_security_state';
const LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type SecurityContextType = {
  isLocked: boolean;
  unlock: () => Promise<boolean>;
};

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, isBiometricsEnabled } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  const lockApp = useCallback(() => {
    if (userToken) {
      setIsLocked(true);
    }
  }, [userToken]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (isBiometricsEnabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AZA',
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
    }
    // Fallback or explicit passcode will be handled by the LockScreen component calling this
    return false;
  }, [isBiometricsEnabled]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App went to background
      backgroundTime.current = Date.now();
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      if (backgroundTime.current) {
        const timeInBackground = Date.now() - backgroundTime.current;
        if (timeInBackground >= LOCK_THRESHOLD_MS) {
          setIsLocked(true);
        }
      }
    }
    appState.current = nextAppState;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Initial check on mount if we should be locked
  useEffect(() => {
    if (userToken) {
      setIsLocked(true);
    }
  }, []); // Only on mount

  return (
    <SecurityContext.Provider value={{ isLocked, unlock }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
