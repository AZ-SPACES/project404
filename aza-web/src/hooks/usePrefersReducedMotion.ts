'use client';
import { useCallback, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion() {
  const subscribe = useCallback((callback: () => void) => {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
  }, []);

  const getSnapshot = useCallback(() => window.matchMedia(QUERY).matches, []);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
