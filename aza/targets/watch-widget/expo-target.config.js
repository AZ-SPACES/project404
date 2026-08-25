/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',

  // #174717 is `primary` in src/theme/index.ts — matches the watch app's accent
  // so the complication reads as the same product on the face.
  colors: { $accent: '#174717' },

  // Must match targets/watch. A complication is embedded in the watch app and
  // shares its process family, so a higher floor here would fail to install on
  // a watch the app itself supports.
  deploymentTarget: '9.4',

  entitlements: {
    // The only channel that exists. A complication runs in its own process with
    // no access to the watch app's memory, Keychain, or WCSession — the shared
    // container is where the snapshot is legible to both.
    'com.apple.security.application-groups': ['group.com.semekor.k.aza'],
  },
});
