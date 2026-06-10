/**
 * Expo config plugin: certificate pinning for api.aza.systems.
 *
 * Pins are applied at the native layer (Android Network Security Config +
 * iOS NSPinnedDomains) so ALL HTTP traffic — Axios, fetch, WebSocket — is
 * covered without any JavaScript changes.
 *
 * ── Updating after a Let's Encrypt renewal (every ~90 days) ─────────────────
 * 1. Run the helper script:  node scripts/check-pins.js
 *    (or manually)
 *    echo | openssl s_client -servername api.aza.systems -connect api.aza.systems:443 2>/dev/null \
 *      | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER \
 *      | openssl dgst -sha256 -binary | base64
 * 2. Replace LEAF_PIN below with the new hash.
 * 3. Update the same hash in:
 *      android/app/src/main/res/xml/network_security_config.xml  (leaf <pin>)
 *      ios/aza/Info.plist  (NSPinnedLeafIdentities SPKI-SHA256-BASE64)
 * 4. Commit and release before the old cert expires.
 *
 * The INTERMEDIATE_PIN (Let's Encrypt E8) is stable across renewals and only
 * needs updating if Let's Encrypt rotates that intermediate CA.
 */

const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const DOMAIN = 'api.aza.systems';

// Leaf cert public key SPKI SHA256 (base64). Expires 2026-08-16.
const LEAF_PIN = 'SwYDgPAIwIJcoIbzr4oG1I54WGJosyj81ErQfBBbMQo=';

// Let's Encrypt E8 intermediate CA SPKI SHA256. Stable across leaf renewals.
const INTERMEDIATE_PIN = 'iFvwVyJSxnQdyaUvUERIf+8qk7gRze3612JMwoO3zdU=';

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">${DOMAIN}</domain>
    <pin-set>
      <pin digest="SHA-256">${LEAF_PIN}</pin>
      <pin digest="SHA-256">${INTERMEDIATE_PIN}</pin>
    </pin-set>
  </domain-config>
</network-security-config>
`;

function withAndroidSslPinning(config) {
  return withAndroidManifest(config, async (modConfig) => {
    const xmlDir = path.join(
      modConfig.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'res', 'xml',
    );
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), NETWORK_SECURITY_XML);

    const app = modConfig.modResults.manifest.application;
    if (app?.[0]?.$) {
      app[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }

    return modConfig;
  });
}

function withIosSslPinning(config) {
  return withInfoPlist(config, (modConfig) => {
    const ats = modConfig.modResults.NSAppTransportSecurity ?? {};
    ats.NSPinnedDomains = {
      [DOMAIN]: {
        NSIncludesSubdomains: false,
        NSPinnedLeafIdentities: [{ 'SPKI-SHA256-BASE64': LEAF_PIN }],
        NSPinnedCAIdentities: [{ 'SPKI-SHA256-BASE64': INTERMEDIATE_PIN }],
      },
    };
    modConfig.modResults.NSAppTransportSecurity = ats;
    return modConfig;
  });
}

module.exports = function withSslPinning(config) {
  config = withAndroidSslPinning(config);
  config = withIosSslPinning(config);
  return config;
};
