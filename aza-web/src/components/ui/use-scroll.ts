'use client';
import { useCallback, useSyncExternalStore } from 'react';

export function useScroll(threshold: number) {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('scroll', callback, { passive: true });
    return () => window.removeEventListener('scroll', callback);
  }, []);

  const getSnapshot = useCallback(() => window.scrollY > threshold, [threshold]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
