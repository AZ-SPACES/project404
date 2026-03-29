import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Spacing, Radius } from '../theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

interface ToastState {
  message: string;
  type: ToastType;
}

const CONFIG: Record<ToastType, { bg: string; fg: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  success: { bg: '#22C55E', fg: '#FFFFFF', icon: 'check-circle' },
  error:   { bg: '#EF4444', fg: '#FFFFFF', icon: 'alert-circle' },
  warning: { bg: '#F59E0B', fg: '#FFFFFF', icon: 'alert-triangle' },
  info:    { bg: '#3B82F6', fg: '#FFFFFF', icon: 'info' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3500) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Reset position before showing
      translateY.setValue(-120);
      opacity.setValue(0);
      setToast({ message, type });

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          bounciness: 8,
          speed: 14,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timeoutRef.current = setTimeout(dismiss, duration);
    },
    [translateY, opacity, dismiss],
  );

  const cfg = toast ? CONFIG[toast.type] : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && cfg && (
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + Spacing.sm,
              backgroundColor: cfg.bg,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          pointerEvents="box-none"
        >
          <Feather name={cfg.icon} size={20} color={cfg.fg} />
          <Text style={[styles.message, { color: cfg.fg }]} numberOfLines={2}>
            {toast.message}
          </Text>
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Dismiss notification"
            accessibilityRole="button"
          >
            <Feather name="x" size={18} color={cfg.fg} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
