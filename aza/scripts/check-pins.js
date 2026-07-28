/**
 * Verifies the live TLS chain for api.aza.systems against the root-CA pins
 * configured in plugins/withSslPinning.js.
 *
 *   node scripts/check-pins.js
 *
 * Pure Node (no openssl, works on Windows/macOS/Linux). Exits non-zero if the
 * served chain does not terminate in a pinned root — run it in CI or as a
 * scheduled check so a Cloudflare CA change is caught before users are.
 */

const tls = require('tls');
const crypto = require('crypto');

const DOMAIN = 'api.aza.systems';
const PORT = 443;

// Keep in sync with ROOT_PINS in plugins/withSslPinning.js.
const { ROOT_PINS } = (() => {
  const plugin = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'plugins', 'withSslPinning.js'),
    'utf8',
  );
  const pins = [...plugin.matchAll(/pin:\s*'([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
  if (pins.length === 0) {
    console.error('Could not parse ROOT_PINS from plugins/withSslPinning.js');
    process.exit(1);
  }
  return { ROOT_PINS: pins };
})();

function spkiHash(cert) {
  // cert.pubkey is the DER-encoded SubjectPublicKeyInfo.
  return crypto.createHash('sha256').update(cert.pubkey).digest('base64');
}

const socket = tls.connect(
  { host: DOMAIN, port: PORT, servername: DOMAIN, rejectUnauthorized: true },
  () => {
    let cert = socket.getPeerCertificate(true);
    const seen = new Set();
    const chain = [];
    while (cert && cert.fingerprint256 && !seen.has(cert.fingerprint256)) {
      seen.add(cert.fingerprint256);
      chain.push(cert);
      cert = cert.issuerCertificate;
    }

    console.log(`\nCertificate chain for ${DOMAIN}:\n`);
    let matched = false;
    chain.forEach((c, i) => {
      const hash = spkiHash(c);
      const isPinned = ROOT_PINS.includes(hash);
      if (isPinned) matched = true;
      console.log(`Cert ${i}: ${c.subject?.CN ?? '(no CN)'}  [issuer: ${c.issuer?.CN ?? '?'}]`);
      console.log(`  valid: ${c.valid_from} → ${c.valid_to}`);
      console.log(`  SPKI SHA256: ${hash}${isPinned ? '   ← PINNED ROOT ✔' : ''}\n`);
    });

    if (matched) {
      console.log('OK: served chain terminates in a pinned root CA.');
      socket.end();
      process.exit(0);
    } else {
      console.error(
        'FAIL: no certificate in the served chain matches a pinned root.\n' +
        'Pinned apps CANNOT reach the API. Check whether Cloudflare switched\n' +
        'certificate authorities, and either restrict the CA in Cloudflare or\n' +
        'add the new root to ROOT_PINS and ship a new build.',
      );
      socket.end();
      process.exit(1);
    }
  },
);

socket.on('error', (e) => {
  console.error('TLS connection failed:', e.message);
  process.exit(1);
});
