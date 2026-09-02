/**
 * Print a JWT + user id for one account, ready to paste into chat_latency_test.mjs.
 *
 * Walks the real login flow: POST /auth/login (password) → OTP is sent to the
 * account's email/phone → POST /auth/verify-otp → AuthResponse, which carries
 * both the access token and the user id. Run it once per account.
 *
 * No dependencies. Node 22+.
 *
 *   BASE_URL=https://api.aza.systems node scripts/get_test_token.mjs
 *
 * Prompts for the identifier (email or phone), the password, and then the OTP.
 * You can pre-fill the first two to skip their prompts:
 *
 *   IDENTIFIER=a@example.com PASSWORD=... node scripts/get_test_token.mjs
 *
 * Accounts with 2FA enabled are rejected — turn 2FA off on throwaway test
 * accounts rather than teaching this script the TOTP dance.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// Node 22's readline Interface no longer exposes _writeToOutput — it moved to
// a private symbol — so the usual trick of overriding that method to mask a
// password is silently dead code, and the secret gets echoed in full. Filter
// at the output stream instead: that is public API, and readline routes every
// echo through it. Reading stdin a second way (an async iterator over the raw
// stream) is not an option either — two consumers fight over the bytes, and
// tearing one down destroys the stream under readline, which throws ABORT_ERR.
let muted = false;
const maskedOutput = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) stdout.write(chunk, encoding);
    callback();
  },
});
// readline reads these off the output stream for cursor math and to decide
// whether it is driving a terminal.
maskedOutput.isTTY = stdout.isTTY;
maskedOutput.columns = stdout.columns;
maskedOutput.rows = stdout.rows;

const rl = createInterface({
  input: stdin,
  output: maskedOutput,
  terminal: Boolean(stdout.isTTY),
});

/** Prompt without echoing what is typed. */
async function askSecret(prompt) {
  // Straight to stdout, bypassing the mask, so the prompt itself still shows.
  stdout.write(prompt);
  muted = true;
  try {
    return await rl.question('');
  } finally {
    muted = false;
    stdout.write('\n'); // the echo we swallowed included the trailing newline
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    const msg = json?.message || json?.error?.message || text.slice(0, 300);
    throw new Error(`${path} → ${res.status}: ${msg}`);
  }
  return json?.data ?? json;
}

function report(auth) {
  const token = auth.accessToken;
  const id = auth.user?.id;
  const who = auth.user?.email || auth.user?.phone || '(unknown)';
  if (!token || !id) throw new Error('login succeeded but no accessToken/user.id in the response');
  console.log(`\n--- ${who} ---`);
  console.log(`token   ${token}`);
  console.log(`user id ${id}`);
  console.log('\nfor chat_latency_test.mjs:');
  console.log(`  TOKEN_?=${token}`);
  console.log(`  (this account's id, if it is the recipient) OTHER_USER_ID=${id}`);
}

async function main() {
  const identifier = process.env.IDENTIFIER || (await rl.question('email or phone: '));
  const password = process.env.PASSWORD || (await askSecret('password: '));

  // Device fields are optional but keep the session labelled in the user's
  // device list, so a stray test login is recognisable later.
  const device = { deviceName: 'chat-latency-test', deviceOs: 'node', deviceId: 'chat-latency-test' };

  const pre = await post('/api/v1/auth/login', { identifier, password, ...device });

  // preLogin returns a plain string when it has sent an OTP, an AuthResponse
  // when the account skipped the second factor, or a 2FA challenge object.
  if (pre && typeof pre === 'object' && pre.accessToken) {
    report(pre);
    return;
  }
  if (pre && typeof pre === 'object' && (pre.preAuthToken || pre.methods)) {
    throw new Error('this account has 2FA enabled — disable it on the test account and retry');
  }

  console.log(typeof pre === 'string' ? pre : 'OTP sent.');
  const code = (await rl.question('OTP code: ')).trim();

  const auth = await post('/api/v1/auth/verify-otp', {
    identifier, code, purpose: 'login', ...device,
  });
  if (auth?.preAuthToken) {
    throw new Error('this account has 2FA enabled — disable it on the test account and retry');
  }
  report(auth);
}

main()
  .catch((e) => { console.error(`\nfailed: ${e.message}`); process.exitCode = 1; })
  .finally(() => rl.close());
