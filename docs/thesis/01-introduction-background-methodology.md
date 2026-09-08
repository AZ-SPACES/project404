# 1. Introduction

## 1.1 Background to the problem

Ghana's retail payments landscape is dominated by mobile money (MoMo) issued by mobile
network operators. That system solved reach — anyone with a SIM can hold value — but it
left three problems unsolved for the population that transacts most:

1. **Money movement is a separate act from the conversation that caused it.** People agree
   a payment in WhatsApp, switch to a USSD or MoMo app, transact, screenshot the receipt,
   and return to the chat. The context and the settlement live in different places, so
   disputes are resolved by screenshots.
2. **Interoperability is transaction-level, not product-level.** A merchant, a marketplace,
   or a developer who wants to *build on* the rails has to negotiate with each operator or
   go through an aggregator. There is no consumer-grade OAuth identity, no hosted checkout
   with marketplace splits, no embedded app surface.
3. **Trust is asserted, not demonstrated.** Consumers cannot verify a statement, a payment
   proof, or a merchant identity without a human intermediary.

AZA was built as an answer to all three at once: a wallet where the chat, the payment, the
merchant acceptance, the agent cash network and the developer platform are one system on
one ledger.

## 1.2 Statement of the problem

Existing digital financial services in Ghana treat messaging, payment, merchant acceptance
and third-party integration as separate, loosely-coupled products. This fragmentation
produces (a) poor user experience for everyday peer-to-peer settlement, (b) high
integration cost for merchants and developers, and (c) weak, non-verifiable audit trails
for consumers. No widely available platform in the market offers private
conversation and regulated e-money settlement within a single, auditable transactional
boundary.

## 1.3 Aim

To design, implement and evaluate an integrated, mobile-first digital financial services
platform that unifies encrypted messaging, peer-to-peer e-money transfer, merchant
acceptance, an agent cash network and a third-party developer platform, under a single
ledger with enforceable financial, security and regulatory invariants.

## 1.4 Objectives

1. **Design a domain and data model** for a multi-tenant e-money system that supports
   consumer wallets, merchant wallets, agent float wallets and platform (marketplace)
   balances without violating the safeguarding invariant that issued e-money equals
   safeguarded balance.
2. **Implement a transactional money engine** that guarantees balanced movement,
   idempotency, concurrency-safe balance updates, and a complete audit trail for every
   value movement.
3. **Implement strong message confidentiality** for chat and chat media, and evaluate the
   trade-off between end-to-end encryption and account-owned history. The objective as
   originally written was "implement end-to-end encryption … with forward secrecy,
   multi-device support and user-held, server-opaque backups". It was met — X3DH v3 with
   per-device identities was built, tested and deployed — and then **deliberately
   withdrawn** for new messages, because per-device encryption makes chat history the
   property of a device rather than of an account, and a user whose only phone is lost or
   replaced loses everything. What ships now is encryption at rest under a server-held key,
   with the E2EE implementation retained for existing history and as the foundation for an
   opt-in mode. **Report the objective in this revised form and treat the trade as the
   result** — §12.4a makes the argument in full; restating the original objective and
   claiming it met would be false.
4. **Build a compliance and risk layer** — tiered KYC, transaction limits, rule-based
   transaction monitoring (velocity, structuring, large-value), sanctions screening,
   maker–checker administrative controls and regulatory reporting.
5. **Expose a third-party platform surface** — API-key merchant APIs, hosted checkout,
   marketplace splits (AZA Connect), OAuth 2.0 + PKCE identity ("Sign in with AZA"),
   payment mandates, and a sandboxed mini-application runtime.
6. **Deliver production-grade delivery engineering** — schema migrations, containerised
   deployment, zero-downtime rollout, automated CI, and operational tooling.
7. **Evaluate** the resulting system against functional completeness, security properties,
   performance under concurrency, and conformance to the stated financial invariants.

## 1.5 Scope and delimitations

**In scope (v1, as implemented):**
- Ghana only; Ghanaian Cedi (GHS) only; single currency, no FX.
- Internal rails: value moves between AZA wallets. Cash enters and leaves through the
  agent network and manual/administered withdrawal flows.
- Consumer mobile app (iOS/Android via Expo), marketing + developer web, admin back
  office, merchant portal, hosted payment pages.
- Third-party integration by API key (server-to-server) and OAuth 2.0 (user-delegated).

**Explicitly out of scope:**
- Multi-currency and cross-border FX.
- Direct interconnection with MNO mobile-money switches or the national switch (GhIPSS)
  — the architecture accommodates it (see `Transaction.TransactionType`
  `PAYOUT`/`DISBURSEMENT`), but no live rail is integrated.
- Card acquiring/issuing.
- Formal regulatory licensing. The system implements controls modelled on Bank of Ghana
  e-money and KYC expectations; it is not a licensed EMI. **[FILL IN: state your
  institution's position on this clearly — it is the single most likely viva question.]**
- Formal cryptographic proof of the E2EE protocol. The implementation follows X3DH; a
  Double Ratchet (post-compromise security) is designed for but not implemented. Note also
  that the protocol governs stored history rather than current traffic (§6.3.0).

## 1.6 Significance / contribution

The contributions defensible in a thesis are:

1. **An integrated architecture** showing that encrypted messaging and regulated value
   transfer can share one transactional boundary, one identity, and one audit trail —
   with a concrete account of the invariants that makes it safe.
2. **A documented set of financial invariants** for a multi-actor e-money ledger (balanced
   movement, debit-before-external-effect, tenant-scoped idempotency, lock-based
   concurrency, maker–checker for administrative movement) and a review methodology that
   operationalises them (`.claude/skills/money-path-review/SKILL.md`).
3. **A practical multi-device E2EE design for a low-resource mobile context, and a
   documented account of why it was traded away** — X3DH with per-device identities,
   consumed one-time pre-keys, per-file media keys, and a randomly-keyed (not PIN-derived)
   chat backup opaque to the server; then the measured argument that per-device encryption
   and account-owned history are incompatible without a cooperating old device, and that in
   a single-device market the second requirement wins. The second half is the more valuable
   contribution: designs of the first kind are well represented in the literature, and
   honest reports of retiring one in production are not.
4. **A developer platform pattern for an African fintech** — hosted checkout with
   marketplace splits to non-merchant sellers, delegated payment mandates, and a
   sandboxed mini-app runtime with an explicit permission and consent model.
5. **An empirical engineering account** of building a system of this size
   (~250,000 lines across eight deployables plus a watchOS companion) with the delivery
   controls that keep a money path safe over 62 schema migrations — including two full
   mechanical verification passes, ten findings, and the movement from six of nine money
   invariants holding unconditionally to nine of nine.
6. **A demonstration that invariants enforced by construction outperform invariants
   verified by inspection**, with the counter-example that makes the point: invariant 4 was
   verified as holding by tracing every documented money path, and three writers on
   undocumented paths took no lock. §5.4a and §16.6 carry the evidence.

## 1.7 Scale of the artefact (measured 2026-09-06)

| Component | Language / stack | Size | 2026-08-21 |
|---|---|---|---|
| Backend | Java 21, Spring Boot 4.0.6 | 64,867 LOC, 767 Java files | 61,330 / 745 |
| — controllers | | 120 | 113 |
| — services | | 116 | 100 |
| — JPA entities | | 111 | 105 |
| — repositories | | 110 | 109 |
| — DTOs | | 259 | 250 |
| — Flyway migrations | | 62 (V1 → V64) | 57 |
| — backend tests | JUnit 5 / Mockito / Testcontainers | 53 classes — **509 tests, all passing** | 40 / 374 |
| Mobile app | React Native 0.86 / Expo 57 / TS | 103,132 LOC, 410 files, 171 feature screens | 98,733 / 387 / 170 |
| — unit tests | Jest + RNTL | 24 suites, **326 tests, all passing** | 17 / 254 |
| — E2E flows | Maestro | 20 flows | 20 |
| — watchOS companion | Swift / SwiftUI / WidgetKit | 1 app + 3 complications + a local Expo module | — |
| `aza-web` (marketing + developer portal) | Next.js 16 | 15,922 LOC | 15,922 |
| `aza-admin` (back office) | Next.js 16 | 26,654 LOC | 26,654 |
| `aza-merchants` (merchant portal) | Next.js 16 | 15,512 LOC | 15,512 |
| `aza-pay` (hosted checkout) | Next.js 16 | 2,014 LOC | 2,014 |
| `aza-superagents` (master-agent console) | Next.js 16 | 3,145 LOC | *empty scaffold* |
| Mini apps + SDK | TypeScript | 7 reference apps + published SDK | same |
| **Total** | | **≈ 253,000 LOC** | ≈ 220,000 |

> Reproduce these numbers with:
> `find backend/src/main/java -name '*.java' | xargs wc -l | tail -1`
> `find aza/src \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1`
>
> Built over **750 commits between 14 March and 3 September 2026** by two principal
> contributors. Every quantitative claim in this documentation set was re-verified against
> the repository on 2026-08-21; the method and results are in `05-limitations-glossary-and-appendices.md`.

## 1.8 Thesis organisation

- **Chapter 1** states the problem, aim, objectives and scope.
- **Chapter 2** reviews mobile money in Africa, e-money regulation, secure messaging
  protocols, and platform/API design; it establishes the gap.
- **Chapter 3** sets out the methodology: iterative delivery, the invariant-driven review
  process, and the evaluation design.
- **Chapter 4** presents the system architecture and data model.
- **Chapter 5** details the implementation: money engine, security and cryptography,
  clients, and the platform APIs.
- **Chapter 6** covers delivery engineering, testing and quality assurance.
- **Chapter 7** evaluates the system against the objectives.
- **Chapter 8** concludes with limitations and future work.


---

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
- **The device-versus-account problem, which is the literature this thesis ends up
  contributing to.** Every design above binds message confidentiality to *device-held* key
  material, and therefore binds history to the device. The standard answers — an encrypted
  backup, a device-to-device transfer, a QR-linked companion — all require the *old* device
  to be present and cooperative, which is precisely the state a lost, stolen or broken phone
  is not in. Signal accepts the loss; WhatsApp offers a backup whose key users routinely
  lose; Telegram and Instagram default to server-readable cloud storage and reserve E2EE for
  an opt-in mode. AZA independently reproduced this decision and took Telegram's answer
  (§12.4a). **[CITE: the secure-messaging usability literature on key management and backup
  loss — Whitten & Tygar for the general result; Signal/WhatsApp/Telegram design docs for the
  three positions.]** For a market where a phone is frequently a user's only device, the
  cost of the Signal position is highest and the argument for the Telegram position
  strongest — which is a claim about *deployment context* rather than about cryptography,
  and is worth stating as such.

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
settlement with private messaging in a single auditable system — and the engineering
invariants that make that combination safe — is thin, particularly for the West African
context. That combination, and the invariant framework around it, is what this thesis
contributes.

There is a second, narrower gap this work fell into and can report from the inside.
Published secure-messaging designs are overwhelmingly reports of systems *as designed*;
reports of a deployed system **retiring** end-to-end encryption, with the reasoning and the
measured cost of the alternative, are rare — understandably, since it is not a flattering
result to publish. §12.4a is that report. The finding is not that E2EE is impractical; it is
that E2EE and account-owned history are incompatible without a cooperating second device,
and that which side of the trade a product should take is determined by how many devices its
users actually have.


---

# 3. Methodology

## 3.1 Development approach

The system was built with an **iterative, feature-sliced** approach rather than a
waterfall specification. Evidence for this is in the repository's own history: features
arrive as vertical slices (schema migration → entity → service → controller → client
screen) and are hardened by follow-up fix commits. Representative sequence from the
recent history:

```
feat: Akyede gifts and bill splitting
feat: bill payments
feat: weighted splits and netting
feat: recurring splits
feat: balances, settle-up, and recurring splits in the app
fix:  V51 altered a table no migration creates
fix:  V12 insert relied on a default a ddl-auto table never has
fix:  V50 retyped store sales through a CHECK that forbade the new type
```

### Version control practice

Worth a short subsection, because the commit history is itself evidence for §3.1's claim
about invariant-driven review. The remediation described in `05-limitations-glossary-and-appendices.md` was
committed in **seven reviewable slices** rather than one bulk commit — one per concern,
each with a message that states the failure scenario before the fix:

```
d290807  chore: stop tracking aza/coverage, and version the thesis docs
468662e  fix: order wallet locks canonically and defer notifications past commit
664f65a  test: run the migration chain and a real concurrency experiment on Postgres
7580280  build: add JaCoCo and run *IT classes under surefire
4da0656  fix: repair two shipping bugs the mobile typecheck was hiding
d93fbeb  ci: run the mobile app's typecheck and tests
008055d  docs: add the thesis documentation set
```

The convention is Conventional Commits (`feat`, `fix`, `test`, `build`, `ci`, `chore`,
`docs`), applied to 308 of the repository's 694 commits. Where a commit fixes a defect,
the message records **what would have gone wrong**, not just what changed — the
lock-ordering commit describes the A→B / B→A deadlock cycle before describing
`WalletLocker`. That is a small discipline with a large payoff for a thesis: the history
becomes a citable record of reasoning rather than a list of edits.

### Measured development history

| Metric | Value |
|---|---|
| Total commits | **694** |
| Development window | 14 Mar 2026 → 15 Aug 2026 (**~5 months**) |
| Mean commit rate | ≈ 4.5 commits/day |
| Contributors | 2 principal (586 + 109 commits), plus automated Vercel commits |
| Commits by conventional-commit type | 210 `feat` · 49 `refactor` · 25 `fix` · 18 `chore` · 2 `test` · 2 `perf` · 2 `docs` |

Two things are worth drawing out of that table rather than leaving it as decoration.

**The feat:fix ratio is 8.4:1.** That is unusually high, and you should interpret it rather
than boast about it: it reflects a greenfield build in which most work was new surface, and
it also reflects that many corrective commits do not carry a `fix:` prefix (only 308 of 694
commits use conventional prefixes at all). Do not present it as a defect-density metric — it
is not one.

**`test` appears twice in 694 commits.** Tests were written alongside features inside `feat`
commits rather than as separate work, which is normal, but it also matches the gaps found in
Chapter 11: no mobile CI job, no coverage instrumentation, no integration tests against a
real database. State the connection honestly — the commit-type distribution is *evidence*
for the quality-assurance limitations reported in §11.8, not a contradiction of them.

Reproduce with:
```bash
git rev-list --count HEAD
git log --reverse --format="%ad" --date=short | head -1
git shortlog -sn --all
git log --format="%s" | grep -oE "^(feat|fix|docs|refactor|chore|test|perf|style)" | sort | uniq -c | sort -rn
```

For the thesis, characterise this as **incremental delivery with invariant-driven review**
— not Scrum, not XP, but a defensible engineering process with three explicit controls:

1. **Schema as versioned migration, never as inferred DDL.** The database is owned by
   Flyway (57 versioned scripts); Hibernate is set to `ddl-auto=validate` and may never
   alter the schema (`application.properties`). Every entity change must be accompanied by
   a migration or the application refuses to boot. This turns a whole class of production
   drift into a build failure.
2. **Money-path review as a formal gate.** Any change touching a wallet, transfer, payout,
   withdrawal, agent float, checkout or Connect path is reviewed against nine written
   financial invariants before merge. The checklist is codified at
   `.claude/skills/money-path-review/SKILL.md` and is reproduced in §5.4. It exists because
   a June 2026 audit found a withdrawal flow that credited a destination and never debited
   the source.
3. **Deploy preflight.** Migration backwards-compatibility, new environment variables,
   image build status and rollout readiness are checked before any production deploy
   (`.claude/skills/deploy-preflight/SKILL.md`).

> **Thesis framing:** these three controls are a *research artefact* in their own right.
> They are the answer to "how do you build a 220k-line financial system safely with a very
> small team?" Present them as a contribution, with the audit finding as the motivating
> incident.

## 3.2 Technology selection and justification

| Layer | Choice | Justification to give in the thesis |
|---|---|---|
| Backend language | Java 21 | Mature transactional/JPA ecosystem, strong static typing for money code, `BigDecimal` as a first-class decimal type, long-term support. |
| Backend framework | Spring Boot 4.0.6 | Declarative transaction boundaries (`@Transactional`), Spring Security filter chain, first-class JPA locking, mature observability. |
| Database | PostgreSQL 16 | ACID, `SELECT … FOR UPDATE` row locking, `NUMERIC(15,2)` exact decimal, mature constraint support (the ledger leans heavily on `CHECK` and `UNIQUE` constraints). |
| Cache / pub-sub | Redis 7 | OTP and rate-limit counters with TTL semantics; presence with a 65-second TTL; WebSocket fan-out across instances. |
| Schema management | Flyway | Versioned, replayable, auditable migrations; `baseline-on-migrate` to adopt a pre-existing ddl-auto schema without replaying one-shot data migrations. |
| Mobile | React Native 0.86 + Expo 57 | One codebase for iOS and Android; Expo modules give hardware-backed key storage (SecureStore), biometrics, camera and notifications without native code. |
| Mobile state | Zustand + TanStack Query | Small client-state store plus a server-cache layer, avoiding a monolithic Redux tree across 171 screens. |
| Web | Next.js 16 / React 19 / Tailwind 4 | Server components for the marketing and hosted-payment surfaces (fast first paint on low-end devices, important for the target market); one component idiom across four apps. |
| Crypto | `@noble/curves`, `@noble/ciphers`, `@noble/hashes` | Audited, dependency-free, constant-time JS implementations of X25519/Ed25519/AES-GCM/HKDF. Justify **not** rolling your own and **not** using a native module. |
| Realtime | STOMP over WebSocket | Structured pub/sub semantics over a single socket, with a Spring-native broker and an auth interceptor. |
| Containerisation | Docker + Compose | Reproducible runtime; a single-host deployment appropriate to the project's scale. |
| CI/CD | GitHub Actions + GHCR | Images are built in CI and only pulled on the server — never built on the droplet. |

## 3.3 Requirements elicitation

**[FILL IN — this is the section most likely to be marked down if you leave it thin.]**
State how requirements were obtained. Candidate sources you actually have:

- The product brief in `PRODUCT.md` (target users: 18–35 in Ghana; the explicit
  anti-references to Wave/Chipper/Cash App define a positioning requirement).
- Regulatory requirements derived from BoG/GSMA KYC-tiering and safeguarding expectations.
- Developer-facing requirements derived from writing the integration guides
  (`docs/AZA_CONNECT.md`, `SIGN_IN_WITH_AZA.md`) — writing the guide first and building to
  it is a legitimate, citable API-design method (documentation-driven development).
- The design specification produced before implementation for the holds feature
  (`HELD_SETTLEMENT_PLAN.md`) — this is a good exhibit: it shows a locked-decision table
  and an explicit vocabulary-design rationale before a line of code was written.
- **[FILL IN: any user interviews, surveys, or usability sessions you ran. If you ran
  none, say so and justify the alternative — a comparative feature analysis against MoMo,
  Chipper and Wave would substitute credibly.]**

## 3.4 Evaluation design

The system is evaluated on four axes. Chapter 7 reports results; the method is:

1. **Functional completeness** — trace each objective in §1.4 to implemented, tested
   artefacts. Instrument: the requirements traceability matrix in
   `04-operations-testing-and-results.md`.
2. **Correctness of the money path** — the nine invariants of §5.4 are checked against
   every money-moving service, evidenced by targeted unit tests
   (`TransferServiceTest`, `CheckoutIdempotencyScopeTest`, `LimitGuardTest`,
   `HoldLedgerAuditServiceTest`, `SafeguardingHeldFloatTest`, `CashStructuringTest`).
3. **Security properties** — a stated threat model with a control mapped to each threat,
   plus the cryptographic test suite (`x3dh.test.ts`, `e2ee.test.ts`,
   `keystore.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts`).
4. **Performance and robustness under concurrency** — **[FILL IN: run these]**
   - Concurrent-transfer test: N parallel transfers from one wallet; assert no
     double-spend and a final balance equal to the arithmetic expectation.
   - API latency under load (e.g. k6 or JMeter) for `POST /api/v1/transfers`,
     `GET /api/v1/wallet/balance`, checkout session creation.
   - WebSocket message delivery latency, cold-start time, and mobile bundle size.

## 3.5 Ethical considerations

- The system processes personal and financial data. Document the data-protection posture:
  soft-delete with a deletion scheduler (`@SQLDelete` on `User`,
  `DeletionSchedulerService`), GDPR-style erasure (`GdprErasureService`), subject data
  requests (`DataRequest`, `AdminDataRequestController`), consent records (`UserConsent`),
  and location-data retention limits (`LocationRetentionScheduler`).
- No real customer funds or real customer data are used in the evaluation.
  **[FILL IN: confirm and state this explicitly.]**
- Cryptographic claims are stated with their limits (no post-compromise security without a
  Double Ratchet) rather than overstated.
