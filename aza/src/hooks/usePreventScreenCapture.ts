import { useFocusEffect } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback } from 'react';

/**
 * Prevents screenshots and screen recording while the screen is focused.
 * Use on sensitive screens: KYC, passcode, OTP, transfers.
 */
export function usePreventScreenCapture() {
  useFocusEffect(
    useCallback(() => {
      ScreenCapture.preventScreenCaptureAsync();
      return () => {
        ScreenCapture.allowScreenCaptureAsync();
      };
    }, []),
  );
}
