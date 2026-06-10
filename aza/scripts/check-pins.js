/**
 * Prints the current SPKI SHA256 hashes for api.aza.systems.
 * Run this after a Let's Encrypt renewal to get the new leaf pin:
 *
 *   node scripts/check-pins.js
 *
 * Then update LEAF_PIN in:
 *   plugins/withSslPinning.js
 *   android/app/src/main/res/xml/network_security_config.xml
 *   ios/aza/Info.plist
 */

const { execSync } = require('child_process');
const crypto = require('crypto');

const DOMAIN = 'api.aza.systems';

function spkiHash(pemCert) {
  const derB64 = execSync(
    `echo "${pemCert.replace(/\n/g, '\\n')}" | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64`,
    { shell: '/bin/sh' },
  ).toString().trim();
  return derB64;
}

try {
  const chain = execSync(
    `echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 -showcerts 2>/dev/null`,
    { shell: '/bin/sh' },
  ).toString();

  const certs = [...chain.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)].map(m => m[0]);

  if (certs.length === 0) {
    console.error('Could not retrieve certificate chain. Is the server reachable?');
    process.exit(1);
  }

  console.log(`\nCertificate chain for ${DOMAIN}:`);
  certs.forEach((cert, i) => {
    const subject = execSync(`echo "${cert}" | openssl x509 -noout -subject -dates 2>/dev/null`, { shell: '/bin/sh' }).toString().trim();
    const hash = execSync(
      `echo "${cert}" | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64`,
      { shell: '/bin/sh' },
    ).toString().trim();
    const label = i === 0 ? '  [LEAF — update LEAF_PIN if changed]' : '  [INTERMEDIATE — stable across renewals]';
    console.log(`\nCert ${i}${label}`);
    console.log(`  SPKI SHA256: ${hash}`);
    console.log(`  ${subject.replace(/\n/g, '\n  ')}`);
  });
  console.log('');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
