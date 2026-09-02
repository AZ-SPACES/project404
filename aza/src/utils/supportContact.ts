import { Linking } from 'react-native';

export const SUPPORT_EMAIL = 'support@aza.systems';

/**
 * Opens the device mail client addressed to support.
 *
 * The in-app support screens (TalkToUs and everything it branches to) are
 * registered on the App stack and every /api/v1/support call behind them needs
 * a session token, so screens reachable while logged out — the sign-in trouble
 * screens, the deactivated-account screens — cannot route there. Email is the
 * one channel that still works with no session, which is what GeoBlockedScreen
 * already falls back to.
 */
export function openSupportEmail(subject: string) {
  Linking.openURL(
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
  ).catch(() => {});
}
