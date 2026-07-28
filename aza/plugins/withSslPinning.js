/**
 * Expo config plugin: certificate pinning for api.aza.systems.
 *
 * Pins are applied at the native layer (Android Network Security Config +
 * iOS NSPinnedDomains) so ALL HTTP traffic — Axios, fetch, WebSocket — is
 * covered without any JavaScript changes.
 *
 * ── Pinning strategy (changed 2026-07: root-CA pins, not leaf pins) ─────────
 *
 * The previous version pinned the origin's Let's Encrypt LEAF key plus one
 * intermediate. That broke every shipped build twice over: Let's Encrypt
 * renews the leaf (new key) every ~90 days, and the domain is now proxied
 * through Cloudflare, which serves its own edge certificate and freely
 * rotates both the certificate and the issuing CA. A native pin cannot be
 * fixed by an OTA update, so a mismatch bricks the app until users install
 * a new binary.
 *
 * We now pin the ROOT CAs of the two authorities Cloudflare issues from for
 * this zone (Let's Encrypt / ISRG and Google Trust Services). Root keys are
 * stable for a decade or more, and validation still fails for any certificate
 * that does not chain to one of these specific roots — a mis-issued cert from
 * any other public CA (the usual MITM path) is rejected.
 *
 * SECURITY NOTE — keep these two ops controls in place:
 *   1. In Cloudflare, restrict Universal SSL to CAs covered here (Let's
 *      Encrypt or Google), so an SSL.com-issued edge cert never appears:
 *      PATCH /zones/{zone}/ssl/universal/settings {"certificate_authority":"lets_encrypt"}
 *   2. The Android <pin-set> has an expiration date. After that date pinning
 *      degrades to standard CA validation instead of hard-failing — a safety
 *      valve so a forgotten update can never brick payments again. Ship an
 *      updated build well before it lapses.
 *
 * Verify the live chain against these pins any time with:
 *   node scripts/check-pins.js
 *
 * Pin provenance (SPKI SHA-256, base64) — computed 2026-07-28 from the
 * CA-published root certificates (letsencrypt.org/certs, i.pki.goog).
 */

const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const DOMAIN = 'api.aza.systems';

// Root CA public keys the API's certificate chain must terminate in.
const ROOT_PINS = [
  { name: "ISRG Root X1 (Let's Encrypt, RSA)",   pin: 'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=' },
  { name: "ISRG Root X2 (Let's Encrypt, ECDSA)", pin: 'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=' },
  { name: 'GTS Root R1 (Google, RSA)',           pin: 'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=' },
  { name: 'GTS Root R2 (Google, RSA)',           pin: 'Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=' },
  { name: 'GTS Root R3 (Google, ECDSA)',         pin: 'QXnt2YHvdHR3tJYmQIr0Paosp6t/nggsEGD4QJZ3Q0g=' },
  { name: 'GTS Root R4 (Google, ECDSA)',         pin: 'mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=' },
];

// After this date Android falls back to standard CA validation instead of
// hard-failing on a pin mismatch. Ship an updated build well before then.
const PIN_SET_EXPIRATION = '2027-08-01';

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">${DOMAIN}</domain>
    <pin-set expiration="${PIN_SET_EXPIRATION}">
${ROOT_PINS.map(({ name, pin }) => `      <!-- ${name} -->\n      <pin digest="SHA-256">${pin}</pin>`).join('\n')}
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
        // CA-level pinning only — the chain must terminate in one of these
        // roots. No leaf pins: leaves rotate with every renewal.
        NSPinnedCAIdentities: ROOT_PINS.map(({ pin }) => ({ 'SPKI-SHA256-BASE64': pin })),
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
