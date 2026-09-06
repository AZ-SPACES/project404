# 6. Security and Cryptography

## 6.1 Threat model

State the threat model explicitly; the controls in this chapter are then answers to it.

| # | Adversary | Capability assumed | Primary controls |
|---|---|---|---|
| T1 | Remote attacker with stolen credentials | Has a password | Multi-factor (TOTP/SMS/email/app-push/passkey), device recognition, new-device login challenge, behavioural detection, IP reputation |
| T2 | Attacker with a stolen unlocked phone | Physical device access | App lock + 4-digit passcode, biometric gate, passcode required per money movement, remote logout-everywhere, device blocking |
| T3 | Network attacker (hostile Wi-Fi, ISP) | Reads/modifies traffic | TLS 1.2+ everywhere, HSTS with `includeSubDomains` and one-year max-age, **native root-CA certificate pinning** on both mobile platforms |
| T4a | Attacker with a **stolen database dump or backup** | Reads persisted data, no access to deployment config | Chat bodies and media keys AES-256-GCM-encrypted at rest under `CHAT_CONTENT_KEY`; TOTP secrets encrypted under `TOTP_ENCRYPTION_KEY`; BCrypt password and passcode hashes. The key material lives in configuration, so the dump alone yields nothing. |
| T4b | Malicious or compromised **server operator** | Full database *and* deployment configuration | **Chat content: not defended, by design since 2026-09-02** (§6.3.0). Defended for pre-`a573783d` history, which remains per-device E2EE ciphertext, and for encrypted backups, whose recovery key is user-held. This row is the honest cost of cross-device history and must not be softened. |
| T5 | Malicious insider (staff) | Valid admin credentials | Role separation, maker–checker dual control, step-up 2FA, admin IP allowlist, hash-chained tamper-evident audit log |
| T6 | Malicious third-party integrator | Valid API key or OAuth client | Scoped restricted keys, tenant-scoped idempotency, ownership checks on every resource, test-mode keys that move no money, rate limiting, webhook signing |
| T7 | Malicious mini-app developer | Code running in the user's WebView | Declared permission manifest, per-user consent records, review before listing, disable/kill switch, CSP and origin isolation, no direct wallet access |
| T8 | Fraudster / money launderer | Legitimate account | Tiered KYC limits, velocity and structuring rules, anomaly scoring with `HELD_FOR_REVIEW`, sanctions screening, regulatory filing |
| T9 | Automated abuse (bots, credential stuffing, scraping) | Volume | Redis token-bucket rate limits (per-IP and per-user), hCaptcha challenge with HMAC-bound tokens, request fingerprinting |

## 6.2 Authentication and session management

### Primary authentication
- Password hashed with BCrypt (`PasswordEncoderConfig`).
- JWT access token, **15-minute** lifetime; refresh token, **30 days**, persisted as
  `RefreshToken` so it can be revoked server-side (a pure stateless JWT cannot be).
- Session policy is `STATELESS`; CSRF is disabled because no cookie-borne credential is
  used for the API — say this explicitly rather than letting `csrf().disable()` look like
  an oversight.

### Second factor — five methods
`User.TwoFactorMethod = { TOTP, SMS, EMAIL, APP, PASSKEY }`

- **TOTP** — RFC 6238. The shared secret is **encrypted at rest with AES-256-GCM**
  (`TotpEncryptionService`, key from `TOTP_ENCRYPTION_KEY`), not stored in plaintext.
  This is a genuinely good detail: a database dump alone does not yield working
  second factors.
- **SMS** via Arkesel; **email** via the Brevo HTTP API (chosen because DigitalOcean blocks
  outbound SMTP ports 25/465/587 — a real deployment constraint worth documenting).
- **APP** — push-approval to an already-authenticated device. The endpoint
  `POST /api/v1/auth/2fa/app/respond` is one of the few `/auth/**` paths that is explicitly
  `authenticated()`, because the responding device already holds a JWT. The ordering of
  that rule *before* the `/api/v1/auth/**` `permitAll` wildcard is load-bearing.
- **PASSKEY** — WebAuthn-style, `passkeysEnabled`.

### Account recovery — three independent paths
1. **Recovery codes** (`RecoveryCode`, `ManageRecoveryCodesScreen`).
2. **Recovery contacts** (`AccountRecoveryContact`) — a social-recovery scheme where
   nominated contacts vouch for the user. All recovery-contact endpoints require full
   authentication (they are not pre-auth flows), enumerated individually in
   `SecurityConfig` ahead of the auth wildcard.
3. **Standard OTP reset** over the registered phone or email.

### Transaction authorisation
Authentication proves who you are; a money movement additionally requires the
**4-digit passcode** (`User.passcodeHash`, BCrypt-hashed), optionally gated behind
biometrics (`expo-local-authentication`). This separation — session credential vs
transaction credential — is invariant #6 and should be drawn as a figure.

**Throttling (verified, `UserService.java:638`):** 5 failed attempts per rolling 5-minute
window, counted per user in Redis with a 5-minute TTL, cleared on success. Passcode *reset*
is separately limited to 3 attempts per 10 minutes and requires an emailed OTP
(`AuthService.java:535`).

State the resulting security margin precisely, because it is a fair examiner's question. A
4-digit passcode has 10⁴ = 10,000 possibilities. At 5 attempts per 5 minutes — 60 per hour —
an online exhaustive search averages **~83 hours** and worst-cases at **~167 hours**: long
enough to be impractical and to be noticed. But note what kind of argument that is: it is a
*throttling* argument, not an entropy one. Note too that the counter has no escalating
backoff and no permanent lockout, so the attacker's rate never degrades. The passcode's real
justification is that it is a second factor on an already-authenticated session on an
already-unlocked device, not a standalone credential.

**A control that existed only on the client, and now does not (`6c724810`).** The rules that
make a 4-digit passcode worth 10⁴ rather than considerably less — no `0000`, no repeated
digit, no straight run — lived solely in `CreatePasscodeScreen`. A modified client or a
direct API call could therefore set `0000` on an account that authorises money movement,
which reduces the margin computed above from ~83 hours to one attempt. `PasscodePolicy`
mirrors the rules server-side and runs at every write path: `setPasscode` covers set,
change and reset, and signup encodes its own. It validates **on write only**, so users
already holding a weak passcode keep working and are caught at their next change — the
standard, and correct, migration posture for a strengthened credential rule, since the
alternative locks existing users out of their own money to fix a problem they did not
create.

This is a good worked example of a general claim the thesis can make about client/server
trust boundaries: a validation rule that lives only in the UI is not a security control at
all, it is a usability affordance, and the two are easy to confuse precisely because they
are written in the same file.

### Device and session management
`DeviceService`, `DeviceBlock`, `device_last_used_location` (V7), logout-everywhere,
per-device E2EE identities, and `NewDeviceLoginScreen` for the unrecognised-device
challenge.

## 6.3 Message confidentiality

This is the most technically substantial part of the system and deserves its own thesis
section with a protocol diagram. It is also the part of the system whose *design changed
under evaluation*, which makes it the most interesting thing in the thesis rather than the
most embarrassing — provided the change is reported as what it was: a deliberate trade,
made for a reason, with the cost named.

### 6.3.0 The change that has to be stated first

**Between 2026-08-21 and 2026-09-02 user-to-user chat stopped being end-to-end encrypted
for new messages.** Any sentence in this chapter that reads "the server holds ciphertext
only" was true of the system audited in August and is not true of the system as it stands.

The forcing problem was cross-device history. Under the E2EE design, a message was
encrypted once per recipient *device*, using key material held in that device's
`expo-secure-store`. A device that logs in fresh — a replacement phone, a second phone, a
reinstall — holds no key material at all, so there is no envelope on the server it can
open. History therefore belonged to a *device*, not to an *account*. The mitigations built
for this (`ChatBackup`, `HistoryTransfer`) both require the *old* device to be present and
cooperative, which is precisely the case a lost or broken phone rules out.

The resolution taken was the one Telegram takes for cloud chats and Instagram takes for
DMs: make the server able to read message bodies, so it can serve history to any device
that authenticates as the account. Concretely (`a573783d`, `68894e13`, `c87c804c`):

| | Before (protocol v3) | After |
|---|---|---|
| Body on the wire | AES-256-GCM envelope, one per recipient device | Plaintext inside TLS |
| Body at rest | Per-device ciphertext rows, server cannot read | Single `content` column, AES-256-GCM under a **server-held** key |
| Who can read it | Only the participants' enrolled devices | The participants' devices **and the server operator** |
| New device gets history | No | Yes |
| Round trips per cold send | 2 key-bundle fetches + fan-out | 0 |

Two secondary effects came with it, and both are worth reporting because neither was the
motivation. The two key-bundle round trips that the per-device fan-out needed on a cold
send disappeared from the send path, where they had been the slowest step; and
`encryptForAllDevices` lost its last caller, along with seven imports that TypeScript did
not flag because the project does not set `noUnusedLocals` — a small, citable illustration
that dead code in a TypeScript codebase is invisible unless you go looking.

**What is still encrypted, and against what.** Losing E2EE is not the same as losing
encryption, and the distinction is the whole of the residual security argument:

- **At rest**, `MessageContentCipher` seals every body before it reaches the `content`
  column: `AES-256-GCM`, 12-byte nonce, 128-bit tag, 32-byte key supplied as
  `app.chat.content-key` (`CHAT_CONTENT_KEY` in the environment), stored as
  `gcm1:base64(nonce ‖ ciphertext ‖ tag)`. A stolen database dump or a leaked backup is
  ciphertext. The key lives in configuration, not in the table, so the two have to be
  stolen separately.
- **In transit**, TLS, with certificate pinning on the mobile client (§6.5).
- **Not** against the server operator, or against anyone who obtains both the dump and the
  deployment configuration. That is the property that was traded away.

Three implementation details are worth citing because each encodes a decision:

1. **The `gcm1:` prefix is a version marker, and its absence is meaningful.** Rows written
   before this existed — support-chat plaintext, and the legacy `content` values — are
   passed through untouched. This is what makes the migration a no-op for existing data
   rather than a rewrite of the whole table.
2. **A missing key degrades loudly but keeps serving.** With no `content-key` configured
   the service logs a warning at construction and stores bodies unencrypted rather than
   refusing to boot, because a development stack holding no real messages should not need
   a secret. The inverse case — encrypted rows present, key gone — logs an error and
   returns `null`, so the client renders a missing message rather than a base64 blob.
3. **A body that cannot be decrypted does not take down the history page.** `decrypt`
   catches and returns `null` per row. One corrupt row costs one message, not the
   conversation.

**Operationally, this key is now a single point of failure for every conversation on the
platform**, which is a genuine new risk the thesis should state rather than bury: rotating
or losing `CHAT_CONTENT_KEY` makes all existing messages unreadable, and no user-held
material can recover them. The compose file carries that warning inline.

### 6.3.1 The E2EE protocol (protocol v3)

The protocol below governed every send up to the change above, **and still governs
decryption of that history**: every message sent before `a573783d` remains a per-device
envelope on the server, so the reading half of `aza/src/crypto/` is load-bearing and is
still exercised by the crypto test suite. Describe it in the past tense for sends and the
present tense for reads. It is also the design a Double Ratchet would extend if the
platform ever moves back to E2EE for a subset of conversations (§13), so it is not
archaeology.

### Primitives

| Purpose | Algorithm | Library |
|---|---|---|
| Key agreement | X25519 ECDH | `@noble/curves` |
| Pre-key signatures | Ed25519 | `@noble/curves` |
| Key derivation | HKDF-SHA256 | `@noble/hashes` |
| Authenticated encryption | AES-256-GCM (12-byte nonce, 16-byte tag) | `@noble/ciphers` |

The `@noble` family was chosen for being audited, dependency-free and constant-time in
pure JavaScript — no native module, so the same code runs identically on iOS, Android and
in tests. Justify this against the alternative (libsodium via a native binding): fewer
build-time platform risks, at some CPU cost.

### Key hierarchy and multi-device identity

Every key is namespaced by `(userId, deviceId)` in `expo-secure-store`, which is
hardware-backed where the platform allows (Android Keystore, iOS Keychain wrapped by the
Secure Enclave). **Private keys never leave `keystore.ts` unencrypted.**

| Key | Type | Lifetime | Published to server |
|---|---|---|---|
| Identity key IK | X25519 | Long-term, per device | Public half only |
| Identity signing key | Ed25519 | Long-term, per device | Public half only |
| Signed pre-key SPK | X25519, signed by Ed25519 IK | Rotated on a cadence; the previous SPK private is retained to decrypt in-flight messages | Public half + signature |
| One-time pre-keys OPK | X25519 | Single use — the private half is **deleted at decrypt time** once used to derive a session | Public halves, in batches |
| Root key | Derived | Per (self, peer) pair; cached in SecureStore | Never |
| Per-message key | Derived | One message | Never |
| Media file key | Random AES-256 | One file | Never (travels inside the message envelope) |
| Backup recovery key | Random 256-bit | User-held | Never |

The server side is `UserKeyBundle` + `KeyBundleService` + `KeyBundleController`: it stores
and serves public bundles and hands out one-time pre-keys, and that is all it can do.

### Protocol v3 — X3DH session establishment

```
DH1 = DH(IK_sender, SPK_recipient)
DH2 = DH(EK_sender, IK_recipient)
DH3 = DH(EK_sender, SPK_recipient)
DH4 = DH(EK_sender, OPK_recipient)        // present when an OPK is available

rootKey = HKDF-SHA256(DH1 ‖ DH2 ‖ DH3 ‖ DH4,
                      info = "aza.chat.v3.x3dh|<senderId>|<chatId>")
```

- **First message:**
  `key = HKDF(rootKey, salt = EK_pub[0..16], info = "aza.chat.v3.msg0|…")`
- **Subsequent messages:** a fresh ephemeral EK per send, with
  `mix = DH(EK_sender, IK_recipient)` and
  `perMsgKey = HKDF(rootKey ‖ mix, salt = EK_pub[0..16], info = "aza.chat.v3.msgN|…")`
- **AAD** binds `(proto, senderId, chatId, ephemeralPub)` as **canonical JSON with sorted
  keys**. The v1 format used a pipe-separated string; it was replaced precisely because a
  delimiter-based binding can be made to collide as fields are added. This is a small but
  genuinely citable design lesson.
- `rootKey` is cached per `(selfUserId, peerUserId)` so only the first send/receive pays
  the X3DH cost.

Wire format of the envelope:

```
ephemeralPublicKey : base64(EK_pub)
ciphertext         : base64( nonce(12) ‖ AES-256-GCM(plaintext) ‖ tag(16) )
```

### Backward compatibility

Three protocol versions coexist. v3 is used for all new sends; **v2** (per-message
ECDH(EK, IK_recipient), canonical-JSON AAD) and **v1** (same, pipe-string AAD) remain as
decrypt-only fallbacks so messages already in flight from older clients at upgrade time
still open. Present this as the realistic answer to protocol migration in a deployed
mobile app: you cannot flag-day a cryptographic format when clients update on their own
schedule.

### Security properties — state these precisely

Scope these to **messages sent under protocol v1–v3**, i.e. history predating
`a573783d`. For messages sent since, the confidentiality claim is the one in §6.3.0:
encryption at rest under a server-held key, not end-to-end.

**Achieved (for v1–v3 history):**
- Confidentiality and integrity against a fully compromised server (T4): for those
  messages the server holds ciphertext, public keys and metadata only. Note the
  consequence, which is the honest counterweight to the change in §6.3.0 — **that history
  is exactly the history a newly linked device cannot read**, which is the problem the
  change was made to solve.
- **Partial forward secrecy.** Sender-side ephemerals are zeroed after send. On the
  recipient side, compromise of `IK_priv` alone is no longer sufficient to decrypt past
  messages — the attacker also needs `SPK_priv` (for DH1 and DH3) and, for each session's
  first message, the `OPK_priv`, which is consumed and deleted at decrypt time. SPK
  rotation bounds the window in which any single compromise is useful.
- Per-device compromise isolation: each device has its own identity, so compromising one
  device does not yield another device's sessions.

**Not achieved — say so:**
- **No post-compromise security (no self-healing).** That requires a Double Ratchet.
  v3 was explicitly designed so a ratchet can layer on top without breaking wire
  compatibility, but it is not implemented. This is the single most important limitation
  to state honestly, and it is already documented in the code's header comment.
- **Metadata** (who talks to whom, when, and message sizes) is visible to the server. E2EE
  protects content, not the social graph — and since §6.3.0, content is visible too.
- **No end-to-end confidentiality for current traffic.** The property above is a property
  of *stored history*, not of the running system. Stating it without that qualification
  would be the single most misleading sentence the thesis could contain.

**Mitigated by user action — safety numbers.** Because key bundles are fetched from an
AZA-operated directory, a malicious server could in principle substitute a key bundle
(the classic active MITM against a key-directory model). The system provides the standard
defence: an out-of-band **safety number** (`e2ee.ts:safetyNumber`, surfaced in
`ChatInfoScreen`). Its construction is worth describing precisely, since it is a small
protocol in itself:

```
sorted   = lexicographic sort of (IK_pub_mine, IK_pub_theirs)   // order-independent
digest   = SHA-256(sorted[0] ‖ sorted[1])
number   = first 30 decimal digits read out of digest, grouped 5 × 6
```

Note what the safety number now does and does not buy. It still detects a substituted
*identity key*, which matters for reading legacy history and for any future ratcheted
mode. It no longer protects the content of new messages, because those are not encrypted
to an identity key at all. Presenting an unchanged safety-number UI over a
server-readable transport would be the worst of both worlds — a security signal that
signals nothing — and §13 records it as a UI debt to be resolved, not a solved problem.

Sorting the two public keys before hashing is what makes both parties compute the *same*
number without exchanging anything. The UI additionally warns the user to re-verify when
the peer's key has rotated. The residual weakness is behavioural, not cryptographic: the
protection only holds if users actually compare the number over a second channel — a
well-documented usability finding in the secure-messaging literature that you should cite
rather than paper over.

**Scope caveat, and how it aged.** At audit, `ChatMessage` carried both a `ciphertext`
field and a `content` field, the latter commented in the entity as *"plaintext, used only
when `chat.isSupport = true`"* — customer-support conversations were stored in the clear,
necessarily, because a human support agent has to read them. The E2EE claim therefore had
to be scoped to **user-to-user** chat or it was simply false.

That caveat is now the *general* case rather than the exception: `content` is the body
column for every chat, support or not, and the only difference support chats retain is
that they were never encrypted at rest either until `MessageContentCipher` began sealing
the column for everyone. Worth reporting as a small lesson in its own right — the field
that existed as a documented exception turned out to be the field the system converged on,
because the constraint that forced it (somebody other than the sender's device must be
able to read this) was never actually specific to support.

### Server-side storage — and why the fan-out was abandoned

`MessageCiphertext` is **one row per (message, device)** — each send stored an envelope for
every recipient device *and* every other sender device, excluding the sending device itself,
which already held the plaintext. Each row carries the `ciphertext`, the `ephemeralKey`,
the `preKeyId`, and — on the first message of a session only — the
`senderIdentityPublicKey` the recipient needs to run X3DH.

The cost of multi-device E2EE is visible right here and is worth quantifying: a message to a
peer with 3 devices, sent from one of the sender's own 2 devices, produced **4 independently
encrypted ciphertext rows**. Storage and bandwidth scaled with the product of the
participants' device counts — the standard price of per-device identities, and precisely why
a group-messaging extension would have needed sender keys rather than naive fan-out.

**This is the quantified case for the trade in §6.3.0**, and it is the strongest evidence
the chapter has that the change was engineering rather than expedience. Per-device fan-out
costs O(devices) storage, O(devices) bandwidth and two synchronous key-bundle fetches per
cold send — and after paying all of that, it still cannot serve history to device *n+1*,
because that device was not enrolled when the envelopes were sealed. The model does not
merely make cross-device history expensive; it makes it *impossible* without a second
mechanism, and both second mechanisms available (`ChatBackup`, `HistoryTransfer`) require
the old device to be alive and cooperating.

The reading path is retained on both sides. `ChatService` still accepts and stores a
`deviceCiphertexts` map when a client sends one, and still returns per-device envelopes on
history pages, because messages sent before the change are the only copies that exist. The
mobile client's `decryptFromSender` and session-root helpers stay for the same reason. Only
the *sending* half was removed. Present this as the general shape of a protocol
retirement in a deployed system: you delete the writer, you keep the reader, and you keep
it for as long as the data lives — which for chat history is indefinitely.

### Media encryption
`mediaCrypto.ts`. Every uploaded file (voice note, image, video, document) is sealed with a
**fresh random 256-bit key** before leaving the device:

```
blob = nonce(12) ‖ AES-256-GCM(file bytes, AAD = "aza.chat.media.v1")
```

The opaque blob goes to Cloudinary. The constant AAD binds the ciphertext to this purpose
so a blob cannot be replayed as some other AES-GCM payload.

**Where the per-file key travels changed with §6.3.0, and the threat model changed with
it.** The key used to ride inside the message's E2EE envelope, so neither AZA nor
Cloudinary held a decryptable file. It now rides in the same server-readable `content`
field as the caption, as a small versioned JSON document:

```
content = { "v": 2, "k": base64(fileKey), "c": caption }
```

so that every device on the account can open the media, not only the devices enrolled when
it was sent — the media half of exactly the problem §6.3.0 solves for text. The residual
property is worth stating precisely, because it is not nothing and it is not
end-to-end either: **the media host never holds a decryptable file**, since Cloudinary
receives the blob and AZA holds the key; and the key is itself encrypted at rest inside
`content`, so a database dump alone yields neither. AZA, holding both the content key and
the blob URL, can decrypt. Sends with no file key — legacy, or a client without the
crypto module — fall back to the plain caption.

### Encrypted backup
`backupCrypto.ts`. Backups are sealed with a **random** 256-bit recovery key — not one
derived from a PIN. This is the key design decision: a PIN-derived key leaves the
server-held blobs brute-forceable offline, whereas a random key leaves nothing to attack.
The key is displayed once as **13 groups of 4 characters** in Crockford base32 (32 symbols,
excluding I, L, O and U; lookalikes are mapped back at parse time, O→0 and I/L→1, so
hand-transcription survives). 32 random bytes encode to 52 characters at 5 bits each
(260 bits ≥ 256). The trade-off — lose the code, lose the backup — is the honest cost of
the property, and should be stated as such.

Server side: `ChatBackup` + `ChatBackupChunk`, chunked so a large history can be uploaded
and restored incrementally. Cross-device history transfer uses the parallel
`HistoryTransfer` + `HistoryTransferChunk` with `HistoryTransferCleanupScheduler`.

## 6.4 Application security controls

| Control | Implementation | Notes |
|---|---|---|
| HSTS | `SecurityConfig` — `includeSubDomains`, `max-age=31536000` | |
| CSP | `default-src 'self'; frame-ancestors 'none'` | API responses; the web apps set their own |
| Clickjacking | `frameOptions().deny()` | |
| MIME sniffing | `contentTypeOptions()` | |
| Referrer policy | `STRICT_ORIGIN_WHEN_CROSS_ORIGIN` | |
| CORS | Explicit origin allow-list from `ALLOWED_ORIGINS`; credentials allowed; a fixed header allow-list (`Authorization`, `X-Device-ID`, `X-Platform`, `X-Api-Key`, `X-Aza-Client`, …) | No wildcard origin anywhere |
| Rate limiting | `RateLimitFilter` + Redis, configurable live via `RateLimitConfig` and `AdminRateLimitController` | Runs after JWT so limits can be per-user. Measured defaults: **150 req/60s per IP**, **200 req/900s per IP on auth paths**, **300 req/60s per request fingerprint**, **500 req/60s per user**, burst threshold 40. Unauthenticated rules key on **device before IP** — see below |
| Passcode strength | `PasscodePolicy`, enforced at every server-side write path | Was client-only until `6c724810`; see §6.2 |
| Email hygiene | `EmailValidationService` (syntax, MX-shaped checks, an 85-domain disposable-provider list loaded at boot) + `V63` case-insensitive unique index on `users.email` | The uniqueness rule was previously held by convention — every write path lowercased — and `PUT /users/me` was the hole. Moving it into the database means a future write path cannot forget it |
| Unverified identity change | Profile updates can no longer change email or phone without going through the verified-change flow (`8a887034`) | A direct `PUT /users/me` was writing `request.getEmail()` through unchanged |
| Bot challenge | `ChallengeService` + hCaptcha, tokens bound by `CHALLENGE_HMAC_SECRET` | |
| Request fingerprinting | `RequestFingerprintService` | |
| IP reputation | `IpReputationService` | |
| Behavioural detection | `BehavioralDetectionService` | |
| Trusted proxy | `TRUSTED_PROXY_IPS` + `nginx/conf.d/cloudflare-real-ip.conf` | Client IP is restored from Cloudflare headers only for trusted ranges — otherwise every per-IP control is trivially spoofable |
| Body size limits | 25 MB multipart file, 30 MB request, 5 MB non-multipart POST | Multipart is raised for mini-app bundles; the endpoints that need tighter limits enforce their own |
| Decompression-bomb defence | `aza.miniapps.max-uncompressed-bytes` bounds the **uncompressed** size during extraction | The compressed cap says nothing about what a zip expands to — a good, specific control to cite |
| **Certificate pinning** | Native root-CA pinning on both platforms via the Expo config plugin `aza/plugins/withSslPinning.js` — see §6.5 | Covers Axios, `fetch` *and* the WebSocket, with no JavaScript involvement |
| Screenshot protection | `expo-screen-capture` in the mobile app | |
| Console stripping | `babel-plugin-transform-remove-console` in production builds | |
| Geographic blocking | `GeoLocationService`, `GeoBlockedScreen` | |
| Soft delete + scheduled erasure | `@SQLDelete`/`@SQLRestriction` on `User`, `DeletionSchedulerService`, `GdprErasureService` | |
| Location retention | `LocationRetentionScheduler` | Transaction location data is aged out |

### Rate limiting under CGNAT — a control that was wrong for the deployment region

Worth a short subsection, because it is the clearest example in the system of a control
that is textbook-correct in general and actively harmful in the market the platform was
built for.

Every unauthenticated limit was keyed on the client IP. Ghanaian mobile carriers front
hundreds of unrelated subscribers behind one public address (carrier-grade NAT), so those
buckets pooled strangers together. The sharpest edge was failed-login scoring: **ten
mistyped passwords spread across a carrier auto-blocked the entire address**, and every
subscriber behind it, none of whom had done anything. A security control had become a
denial-of-service against ordinary users, delivered by the platform to itself.

`8330092c` keys rules 4, 7, 8 and 11 and the post-response scoring on `X-Device-ID` when
the caller presents one, and keeps the strict per-IP limit for callers that present no
device identity — so the fallback is the stricter behaviour, not the looser one, and a
client that omits the header gains nothing. The identifier-availability endpoints used
during signup gained a per-device budget of their own, with 429 handling and a
stale-response guard on the three screens that call them.

The methodological point for the thesis is that a device identifier is *weaker* evidence
than an IP — it is client-supplied and trivially rotated — and the change was made anyway,
because the question a rate limiter answers is not "who is this?" but "are these requests
the same actor?", and under CGNAT the IP answers that question wrongly for the honest
majority. Defence in depth carries the residual risk: fingerprinting, hCaptcha and
behavioural detection all still key independently. Covered by
`RateLimitFilterActorKeyTest` (new).

## 6.5 Certificate pinning — a case study worth writing up

Implemented as an Expo config plugin (`aza/plugins/withSslPinning.js`) applied at the
**native** layer on both platforms — Android Network Security Config and iOS
`NSPinnedDomains` — so *all* traffic is covered (Axios, `fetch`, and the WebSocket) with no
JavaScript involvement.

This is one of the strongest short narratives in the codebase. Give it a full subsection.

**The first design failed twice in production.** It pinned the Let's Encrypt **leaf** key
plus one intermediate. Two things broke it:

1. Let's Encrypt renews the leaf — with a **new key** — roughly every 90 days.
2. The domain is proxied through Cloudflare, which serves its own edge certificate and
   rotates both the certificate and the issuing CA at will.

And the compounding factor: **a native pin cannot be fixed by an OTA update.** A mismatch
bricks the app for every installed user until they download a new binary. In a payments app,
that is an outage with no remote remedy.

**The current design (changed 2026-07) pins root CAs instead.** Six SPKI-SHA256 pins across
the two authorities Cloudflare issues from for this zone:

| Root | Authority |
|---|---|
| ISRG Root X1 (RSA), ISRG Root X2 (ECDSA) | Let's Encrypt |
| GTS Root R1, R2 (RSA), R3, R4 (ECDSA) | Google Trust Services |

Root keys are stable for a decade or more, while validation still rejects any certificate
that does not chain to one of those specific roots — closing the realistic MITM path, a
mis-issued certificate from some other public CA or a locally-installed interception root.

**Two supporting controls make it safe rather than merely clever, and both belong in the
write-up:**

- **A coupled operational control.** Cloudflare Universal SSL must be restricted to the same
  CAs (`PATCH /zones/{zone}/ssl/universal/settings {"certificate_authority":"lets_encrypt"}`),
  or an edge certificate from a third CA would appear and fail validation. The pin set and
  the CDN configuration are one system; changing either alone causes an outage.
- **An expiry safety valve.** The Android `<pin-set>` carries `expiration="2027-08-01"`.
  After that date pinning **degrades to standard CA validation instead of hard-failing** —
  a deliberate decision that a forgotten update can never again brick payments.

A verification script, `node aza/scripts/check-pins.js`, checks the live chain against the
pin set.

**State the trade-off honestly.** Root-CA pinning is materially weaker than leaf pinning: it
trusts every certificate those two CAs issue for this domain, so it does not defend against
an adversary who can compel or compromise Let's Encrypt or Google Trust Services. It defends
against the realistic threat while remaining operable through routine certificate rotation.
That is the right call for this system — and articulating *why* is what turns a checkbox
into a contribution. It is also a clean illustration of a general principle worth naming in
the thesis: **a security control that cannot survive normal operations will be disabled, so
availability is a security property, not a competing concern.**

## 6.6 Verifiable artefacts

A distinctive feature: AZA issues artefacts that a **third party can verify without an
account**, addressing the "trust is asserted, not demonstrated" problem from §1.1.

- **Statement verification** — `GeneratedStatement`, `StatementVerifyController`,
  public `GET /api/v1/public/statements/verify` and a rendered page. An employer or bank
  can confirm a downloaded PDF statement is genuine.
- **Payment proof** — `PaymentProofController`, `PaymentProofService`. A QR code carrying
  its own **HMAC signature** (`PAYMENT_PROOF_HMAC_SECRET`), verifiable at the public
  endpoint. Because the signature is in the QR, the verifying endpoint needs no auth and
  the proof cannot be forged without the server key.
- **Merchant verification** — `MerchantVerifyResultScreen`, public merchant profile by
  handle, so a customer can confirm a store QR belongs to a KYB-verified business.

## 6.7 Compliance and risk controls

**KYC / KYB.** `KycService` with document and selfie capture (`ScanIdScreen`,
`SelfieScanScreen`, `VerifyFaceIdScreen`), source-of-funds and PEP declaration flows,
tiered limits (§5.2), annual re-review (`kycReviewDueAt`, +1 year on each approval,
`AdminKycExpiryController`), and `requireSelfieVerification` as a re-challenge flag.
Merchant KYB is available both on the web and via a **token-authenticated mobile handoff**
(`MobileKybService`, public `/api/v1/public/kyb-mobile/*` endpoints) so a business owner can
photograph documents with their phone mid-application.

`kyc.auto-verify` defaults to `false` and is documented as a local/demo-only switch.

**Transaction monitoring.** `RiskEngineService.evaluateTransfer` runs after each completed
transfer and applies four checks:

1. `checkLargeTransfer` — value threshold.
2. `checkVelocity` — count/value in a rolling window.
3. `checkStructuring` — the smurfing heuristic: **three or more transfers in 24 hours,
   each in the 70–100% band of the large-transfer threshold**.
4. `evaluateAnomaly` — scoring written back to `Transaction.anomalyScore` and
   `anomalyRiskLevel`; a HIGH score at confirmation moves the transaction to
   `HELD_FOR_REVIEW`.

Every evaluation writes a `RiskDecisionLog`, so the compliance position is reconstructable
after the fact. Thresholds live in `RiskRuleService` so COMPLIANCE can tune them live
without a deploy.

**The design rule to highlight: risk evaluation must never fail a transfer.** The whole
method body is wrapped in a try/catch that logs and continues. Discuss the trade-off — a
monitoring bug must not become a payments outage — and its cost: a silent evaluation
failure leaves a transaction unscored, which is why the decision log exists.

> **The cost was paid, and it is worth writing up in full (`V64`, September 2026).** The
> rule above assumes the failure it swallows is *contained*. It is not, when the failure is
> a database error, because a rejected statement poisons the whole JDBC transaction.
>
> On databases adopted from the legacy `ddl-auto=update` era, Hibernate had generated a
> `CHECK` constraint on `transactions.status` enumerating the statuses that existed at the
> time. `HELD_FOR_REVIEW` was added later, for this very hold. So on those databases the
> `UPDATE` that holds a suspicious transfer was rejected outright — and because the flush
> landed inside the risk engine's catch block, the exception was logged and swallowed
> exactly as designed. The transaction was already aborted, so the failure surfaced two
> statements later, on an unrelated `notifications` INSERT, as *"current transaction is
> aborted"*. **The user saw a raw Postgres error on the PIN screen, and the transfer was
> neither sent nor held.**
>
> Three things make this worth a paragraph rather than a footnote. First, the control that
> failed was the fraud hold — the failure mode was "high-risk transfers are not held", which
> is the one outcome the control exists to prevent. Second, the defensive `try/catch` did not
> merely fail to help; it *converted a clear error into a misleading one three call frames
> away*, which is a general and citable hazard of catch-and-continue around a transactional
> resource. Third, the root cause was schema drift from a superseded migration strategy —
> the same dynamic already recorded in `V31`, `V34` and `V38` — which is the strongest
> argument the thesis has for §10's insistence that the schema be Flyway's alone.
>
> The remedy drops the stale constraint, matching on `conkey` rather than on the constraint
> text so that only single-column CHECKs on `status` are touched; `transactions` also carries
> `type` and `recipient_type` constraints that a text match would have swept up. The value
> set is enforced by the Java enum, so the database CHECK was adding no safety to lose.

**Screening and reporting.** `ScreeningService` against `SanctionsListEntry` producing
`ScreeningMatch` — now paginated, because loading the whole sanctions list into memory to
screen one name scales with the list rather than the query (`e8d1066a`); `RegulatoryService` + `RegulatoryFiling`; `ComplianceService`;
`ReconciliationService` producing `ReconBreak`; `SafeguardingSnapshot` for the
issued-vs-safeguarded position; `AccountingExportService` for finance.

**Consumer protection.** `Dispute` + `DisputeService`, `Complaint`, `HandleReport`
(reporting impersonating handles), `MiniAppReport`, `AdminSlaController` for response-time
tracking, `AccountClosureRequest`, `DataRequest` for subject access.
