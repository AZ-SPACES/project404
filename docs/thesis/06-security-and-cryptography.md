# 6. Security and Cryptography

## 6.1 Threat model

State the threat model explicitly; the controls in this chapter are then answers to it.

| # | Adversary | Capability assumed | Primary controls |
|---|---|---|---|
| T1 | Remote attacker with stolen credentials | Has a password | Multi-factor (TOTP/SMS/email/app-push/passkey), device recognition, new-device login challenge, behavioural detection, IP reputation |
| T2 | Attacker with a stolen unlocked phone | Physical device access | App lock + 4-digit passcode, biometric gate, passcode required per money movement, remote logout-everywhere, device blocking |
| T3 | Network attacker (hostile Wi-Fi, ISP) | Reads/modifies traffic | TLS 1.2+ everywhere, HSTS with `includeSubDomains` and one-year max-age, **native root-CA certificate pinning** on both mobile platforms, E2EE payloads that are ciphertext before they hit the socket |
| T4 | Malicious or compromised **server operator** | Full database and server access | End-to-end encryption of chat, media and backups: the server holds only ciphertext and public keys. This is the strongest claim the system makes. |
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

### Device and session management
`DeviceService`, `DeviceBlock`, `device_last_used_location` (V7), logout-everywhere,
per-device E2EE identities, and `NewDeviceLoginScreen` for the unrecognised-device
challenge.

## 6.3 End-to-end encryption

This is the most technically substantial part of the system and deserves its own thesis
section with a protocol diagram.

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

**Achieved:**
- Confidentiality and integrity against a fully compromised server (T4): the server holds
  ciphertext, public keys and metadata only.
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
  protects content, not the social graph.

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

Sorting the two public keys before hashing is what makes both parties compute the *same*
number without exchanging anything. The UI additionally warns the user to re-verify when
the peer's key has rotated. The residual weakness is behavioural, not cryptographic: the
protection only holds if users actually compare the number over a second channel — a
well-documented usability finding in the secure-messaging literature that you should cite
rather than paper over.

**Scope caveat that must be stated — support chats are not E2EE.** `ChatMessage` carries
both a `ciphertext` field and a `content` field, the latter commented in the entity as
*"plaintext, used only when `chat.isSupport = true`"*. Customer-support conversations are
stored in the clear, necessarily, because a human support agent has to read them. This is
the correct design, but the E2EE claim must be scoped to **user-to-user** chat, or it is
simply false. One sentence covers it; omitting it is the kind of gap a viva finds.

### Server-side storage of encrypted messages

`MessageCiphertext` is **one row per (message, device)** — each send stores an envelope for
every recipient device *and* every other sender device, excluding the sending device itself,
which already holds the plaintext. Each row carries the `ciphertext`, the `ephemeralKey`,
the `preKeyId`, and — on the first message of a session only — the
`senderIdentityPublicKey` the recipient needs to run X3DH.

The cost of multi-device E2EE is visible right here and is worth quantifying: a message to a
peer with 3 devices, sent from one of the sender's own 2 devices, produces **4 independently
encrypted ciphertext rows**. Storage and bandwidth scale with the product of the
participants' device counts — the standard price of per-device identities, and precisely why
a group-messaging extension would need sender keys rather than naive fan-out.

### Media encryption
`mediaCrypto.ts`. Every uploaded file (voice note, image, video, document) is sealed with a
**fresh random 256-bit key** before leaving the device:

```
blob = nonce(12) ‖ AES-256-GCM(file bytes, AAD = "aza.chat.media.v1")
```

The opaque blob goes to Cloudinary; the per-file key travels inside the message's E2EE
envelope. Neither AZA nor Cloudinary ever holds a decryptable file. The constant AAD binds
the ciphertext to this purpose so a blob cannot be replayed as some other AES-GCM payload.

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
| Rate limiting | `RateLimitFilter` + Redis, configurable live via `RateLimitConfig` and `AdminRateLimitController` | Runs after JWT so limits can be per-user. Measured defaults: **150 req/60s per IP**, **200 req/900s per IP on auth paths**, **300 req/60s per request fingerprint**, **500 req/60s per user**, burst threshold 40 |
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

**Screening and reporting.** `ScreeningService` against `SanctionsListEntry` producing
`ScreeningMatch`; `RegulatoryService` + `RegulatoryFiling`; `ComplianceService`;
`ReconciliationService` producing `ReconBreak`; `SafeguardingSnapshot` for the
issued-vs-safeguarded position; `AccountingExportService` for finance.

**Consumer protection.** `Dispute` + `DisputeService`, `Complaint`, `HandleReport`
(reporting impersonating handles), `MiniAppReport`, `AdminSlaController` for response-time
tracking, `AccountClosureRequest`, `DataRequest` for subject access.
