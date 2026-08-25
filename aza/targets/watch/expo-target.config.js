/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',

  // Reuses the phone app's icon so the watch app is recognisable on the dock.
  icon: '../../assets/icon.png',

  // #174717 is `primary` in src/theme/index.ts — the accent SwiftUI applies to
  // controls and the app's tint on the watch face.
  colors: { $accent: '#174717' },

  // Deliberately matched to the iOS floor rather than raised. ios.deploymentTarget
  // is 16.4 (ios/Podfile), and watchOS 10 requires a phone on iOS 17 — pairing a
  // watchOS 10 app with a 16.4 phone is not possible, so raising this would strand
  // users the phone app still supports. Revisit when the iOS floor moves.
  deploymentTarget: '9.4',

  entitlements: {
    // Shared container so the watch app and (later) the complication can read the
    // wallet snapshot the phone writes. WatchConnectivity alone cannot serve a
    // WidgetKit complication: it runs in its own process with no access to the
    // app's memory or Keychain.
    'com.apple.security.application-groups': ['group.com.semekor.k.aza'],
  },
});
