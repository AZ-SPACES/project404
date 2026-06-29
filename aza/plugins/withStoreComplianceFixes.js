/**
 * Expo config plugin: App Store / Play Store compliance fixes.
 *
 * The native `ios/` and `android/` folders are gitignored generated output, so any
 * hand-edit to Info.plist / AndroidManifest.xml is wiped on the next `expo prebuild`
 * / EAS build. This plugin encodes those fixes in version-controlled config so they
 * survive regeneration.
 *
 * What it does:
 *  iOS (Info.plist):
 *   - Force UIBackgroundModes to ["audio"] only. We do NOT register any
 *     BGTask/BackgroundFetch, so declaring "processing"/"fetch" is an Apple 2.5.4
 *     rejection (declaring unused background modes).
 *   - Set a specific NSLocationWhenInUseUsageDescription (fraud-prevention purpose).
 *   - Strip the "Always" location keys — the app only uses foreground location
 *     (see src/utils/deviceLocation.ts), and requesting Always invites rejection.
 *   (ITSAppUsesNonExemptEncryption is set via app.json -> ios.config.usesNonExemptEncryption.)
 *
 *  Android (AndroidManifest.xml):
 *   - Block permissions that autolinked libraries inject but we don't want:
 *       SYSTEM_ALERT_WINDOW  (draw-over-other-apps; pulled in by WebRTC/incall) — heavily
 *                            scrutinized by Google; we don't use overlays.
 *       READ_CONTACTS        (no device-contacts feature exists; the app's "contacts"
 *                            are in-app Aza users).
 *       ACCESS_FINE_LOCATION (expo-location autolinks it; coarse/city-level is enough).
 */

const { withInfoPlist, AndroidConfig } = require('@expo/config-plugins');

const LOCATION_WHEN_IN_USE =
  'Aza uses your city-level location when you sign in or send money to detect ' +
  'suspicious activity and protect your account. No precise coordinates are stored.';

const BLOCKED_ANDROID_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_CONTACTS',
  'android.permission.ACCESS_FINE_LOCATION',
];

function withIosComplianceFixes(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // Only background mode we actually use (voice-message playback).
    plist.UIBackgroundModes = ['audio'];

    // Foreground-only location with a specific, honest purpose string.
    plist.NSLocationWhenInUseUsageDescription = LOCATION_WHEN_IN_USE;
    delete plist.NSLocationAlwaysUsageDescription;
    delete plist.NSLocationAlwaysAndWhenInUseUsageDescription;

    return cfg;
  });
}

module.exports = function withStoreComplianceFixes(config) {
  config = withIosComplianceFixes(config);
  config = AndroidConfig.Permissions.withBlockedPermissions(
    config,
    BLOCKED_ANDROID_PERMISSIONS,
  );
  return config;
};
