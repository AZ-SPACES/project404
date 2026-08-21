# 2. Background and Literature

This chapter gives you the concepts the thesis assumes and points at the literature you
should cite. Citations are indicated as **[CITE: …]** — you must locate and format them.

## 2.1 Mobile money and digital financial services in Africa

Key threads to review:

- The M-Pesa literature on agent networks, float management and the economics of
  cash-in/cash-out. **[CITE: Jack & Suri; Mas & Radcliffe]**
- Ghana-specific: mobile money interoperability via GhIPSS, MoMo penetration statistics,
  the Payment Systems and Services Act, 2019 (Act 987). **[CITE: Bank of Ghana]**
- The "super-app" thesis (WeChat, Grab, Gojek): a payment rail plus an embedded
  third-party application surface. AZA's Mini App Hub is a direct instance of this pattern.
  **[CITE: literature on platform envelopment / super-apps]**

### Concepts you must define in the thesis

| Concept | Definition as used in this work |
|---|---|
| **E-money** | A stored monetary value issued against funds received, redeemable at par, used to make payments to parties other than the issuer. |
| **Safeguarding** | The requirement that the total e-money in issue is fully backed by funds held in a segregated/trust account. AZA's ledger maintains this as an invariant (§5). |
| **Float** | Liquidity an agent holds (in e-money or cash) to serve cash-in and cash-out. |
| **Cash-in / cash-out** | Physical cash converted to wallet balance and vice versa, through an agent. In AZA these are ordinary internal wallet-to-wallet transfers plus a physical cash leg. |
| **KYC tiering** | Graduated identity requirements with graduated transaction limits — the standard BoG/GSMA risk-proportionate approach. |
| **MDR** | Merchant discount rate — the fee a merchant pays on an accepted payment. |
| **Maker–checker** | Dual control: the person who initiates a privileged action cannot approve it. |

## 2.2 Ledger and transaction integrity

The thesis should ground the money engine in established ideas:

- **ACID transactions and isolation levels.** AZA uses PostgreSQL with
  `SELECT … FOR UPDATE` pessimistic row locks on wallets rather than optimistic
  read-modify-write. Discuss the lost-update anomaly and why locking (not application-level
  compare-and-set) is the correct choice for a balance. **[CITE: Bernstein & Newcomer; Kleppmann, *Designing Data-Intensive Applications*, ch. 7]**
- **Idempotency in payment APIs.** Idempotency keys as the standard defence against
  client retries over an unreliable network; the subtlety that a key must be scoped to the
  tenant, or a collision leaks another tenant's result. AZA scopes checkout and Connect
  idempotency per merchant (`V43__scope_checkout_idempotency_per_merchant.sql`,
  `connect_transfers_merchant_idem_key`). **[CITE: Stripe's idempotency design; RFC draft on the Idempotency-Key header]**
- **Double-entry vs single-entry balances.** AZA holds a materialised balance on `wallets`
  plus an append-only `transactions` record. Discuss the trade-off (read performance and
  simplicity vs. derivability) and the reconciliation job that closes the gap
  (`ReconciliationService`, `ReconBreak`).
- **Exactly-once vs at-least-once side effects.** The rule "debit before external effect,
  never fire the external effect first and debit on callback" is the practical resolution.

## 2.3 Secure messaging

AZA's chat implements the **X3DH (Extended Triple Diffie-Hellman)** asynchronous key
agreement, the same primitive underlying the Signal Protocol.

- **X3DH.** Establishes a shared secret between two parties when the recipient is offline,
  using a long-term identity key (IK), a signed pre-key (SPK) and an optional one-time
  pre-key (OPK) published to a server. **[CITE: Marlinspike & Perrin, "The X3DH Key Agreement Protocol", Signal, 2016]**
- **Double Ratchet.** Provides post-compromise security (self-healing) via continuous key
  ratcheting. **[CITE: Perrin & Marlinspike, "The Double Ratchet Algorithm", 2016]**
  AZA's v3 protocol is explicitly designed so a ratchet can layer on top without breaking
  wire compatibility — this is a stated limitation, not an omission (see
  `aza/src/crypto/e2ee.ts` header comment).
- **Primitives used.** X25519 for ECDH, Ed25519 for pre-key signatures, HKDF-SHA256 for
  key derivation, AES-256-GCM for authenticated encryption with associated data.
  **[CITE: RFC 7748 (X25519), RFC 8032 (Ed25519), RFC 5869 (HKDF), NIST SP 800-38D (GCM)]**
- **Multi-device E2EE.** The hard problem is that a per-user identity is insufficient — each
  device needs its own identity and its own pre-key bundle, and a message must be
  fanned out to every device of the recipient. AZA namespaces every key by
  `(userId, deviceId)` (`aza/src/crypto/keystore.ts`).
  **[CITE: Signal's Sesame protocol; literature on multi-device secure messaging]**
- **Encrypted backup.** Deriving a backup key from a user PIN makes the ciphertext
  brute-forceable server-side. AZA instead uses a random 256-bit key rendered as a 13-group
  Crockford base32 code that the user alone holds. **[CITE: WhatsApp E2EE backup whitepaper for the contrasting HSM-based approach]**

## 2.4 Identity, delegation and API platforms

- **OAuth 2.0 Authorization Code with PKCE** as the correct flow for public clients.
  **[CITE: RFC 6749, RFC 7636; OAuth 2.0 Security BCP RFC 9700]**
- **Delegated payment** — going beyond identity to authorising value movement on a user's
  behalf, bounded by explicit consent. AZA implements this as `OAuthPaymentController`
  and **payment mandates** (`V48__payment_mandates.sql`): a user-approved recurring charge
  with ceilings and cadence.
- **Marketplace / split payments.** The platform-of-record pattern (one KYB'd platform,
  many un-onboarded sellers). Compare AZA Connect with Stripe Connect's Express/Custom
  models — AZA's v1 deliberately keeps sellers as ordinary users rather than sub-merchants.
- **Sandboxed third-party runtimes.** Mini apps run in a WebView with an injected
  `window.aza` bridge, a declared permission set, and a per-user consent record
  (`MiniAppConsent`). Cite the literature on capability-based security and on the mini-program
  security model. **[CITE: analyses of WeChat mini-program security]**

## 2.5 Risk, fraud and AML controls

- **Structuring / smurfing detection.** Repeated transfers just below a reporting
  threshold. AZA's `RiskEngineService.checkStructuring` uses the classic heuristic: ≥3
  transfers in 24h each in the 70–100% band of the large-transfer threshold.
  **[CITE: FATF Recommendations; AML transaction-monitoring literature]**
- **Velocity rules and behavioural detection.** `RiskEngineService.checkVelocity`,
  `security/behavior/BehavioralDetectionService`, `AnomalyDetectionService`.
- **Sanctions screening.** `ScreeningService`, `SanctionsListEntry`, `ScreeningMatch`.
- **Device and IP reputation.** `security/fingerprint/RequestFingerprintService`,
  `security/reputation/IpReputationService`, `DeviceBlock`.
- Discuss the false-positive cost trade-off: AZA's design decision is that risk
  evaluation **must never fail a transfer** (the engine catches and logs), and that a HIGH
  anomaly instead moves the transaction to `HELD_FOR_REVIEW` for a compliance officer.

## 2.6 The gap this work addresses

The literature treats these as separate systems: mobile money platforms, secure messengers,
payment APIs, and super-app runtimes. Published work on *combining* regulated e-money
settlement with end-to-end encrypted messaging in a single auditable system — and the
engineering invariants that make that combination safe — is thin, particularly for the
West African context. That combination, and the invariant framework around it, is what
this thesis contributes.
