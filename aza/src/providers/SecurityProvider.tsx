import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from './AuthProvider';

const LOCK_TIMEOUT_KEY = 'aza_lock_timeout_ms';
const APP_LOCK_ENABLED_KEY = 'aza_app_lock_enabled';
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const LOCK_TIMEOUT_OPTIONS: { label: string; value: number }[] = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute',    value: 60 * 1000 },
  { label: '5 minutes',   value: 5 * 60 * 1000 },
  { label: '15 minutes',  value: 15 * 60 * 1000 },
  { label: '30 minutes',  value: 30 * 60 * 1000 },
  { label: '1 hour',      value: 60 * 60 * 1000 },
];

type SecurityContextType = {
  isLocked: boolean;
  appLockEnabled: boolean;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
  lockTimeoutMs: number;
  setLockTimeout: (ms: number) => Promise<void>;
  unlock: () => Promise<boolean>;
};

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, isBiometricsEnabled } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [appLockEnabled, setAppLockEnabledState] = useState(true);
  const [lockTimeoutMs, setLockTimeoutMs] = useState(DEFAULT_LOCK_TIMEOUT_MS);
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(LOCK_TIMEOUT_KEY, SECURE_OPTS),
      SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY, SECURE_OPTS),
    ]).then(([timeout, lockEnabled]) => {
      if (timeout !== null) setLockTimeoutMs(parseInt(timeout, 10));
      if (lockEnabled !== null) setAppLockEnabledState(lockEnabled !== 'false');
    });
  }, []);

  const setAppLockEnabled = useCallback(async (enabled: boolean) => {
    setAppLockEnabledState(enabled);
    if (!enabled) setIsLocked(false);
    await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, String(enabled), SECURE_OPTS);
  }, []);

  const setLockTimeout = useCallback(async (ms: number) => {
    setLockTimeoutMs(ms);
    await SecureStore.setItemAsync(LOCK_TIMEOUT_KEY, String(ms), SECURE_OPTS);
  }, []);

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
    return false;
  }, [isBiometricsEnabled]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      backgroundTime.current = Date.now();
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (backgroundTime.current !== null && appLockEnabled && userToken) {
        const elapsed = Date.now() - backgroundTime.current;
        if (elapsed >= lockTimeoutMs) setIsLocked(true);
      }
    }
    appState.current = nextAppState;
  }, [lockTimeoutMs, userToken, appLockEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  // Lock on first mount when logged in (only if app lock is enabled)
  useEffect(() => {
    if (userToken && appLockEnabled) setIsLocked(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SecurityContext.Provider value={{ isLocked, appLockEnabled, setAppLockEnabled, lockTimeoutMs, setLockTimeout, unlock }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within a SecurityProvider');
  return context;
};
