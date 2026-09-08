# 13. Limitations and Future Work

## 13.1 Limitations

State these yourself. Every one of them is defensible; none of them is fatal.

### Architectural
1. **Single-instance real-time delivery.** `WEBSOCKET_LOCAL_DELIVERY=true` bypasses Redis
   pub/sub, which is correct only on one backend instance. The fan-out path exists and is
   a configuration flip, but has not been exercised in production.
2. **Schedulers run in-process.** Nine `@Scheduled` jobs would double-execute on a second
   instance without a distributed lock or leader election.
3. **Single database, no read replicas.** Every read and write hits one PostgreSQL
   instance.
4. **Materialised balances rather than a derived double-entry ledger.** Faster and simpler,
   but the authoritative balance is a column, not a sum — which is why
   `ReconciliationService` and `ReconBreak` exist. A true double-entry model would make
   reconciliation unnecessary.
5. **Polymorphic `Transaction.recipientId`** cannot carry a foreign key, so referential
   integrity for the recipient is enforced by application code and by convention.

### Financial and regulatory
6. **GHS only, Ghana only, internal rails.** No FX, no interconnection with MNO
   mobile-money switches or GhIPSS, no card acquiring.
7. **KYC tier limits are placeholders.** The `KycTier` enum says so in its own Javadoc;
   the figures must be reconciled against current Bank of Ghana directives.
8. **Not a licensed institution.** The controls are modelled on regulatory expectations;
   the system has not been through supervisory approval.
9. **Sanctions screening is list-matching**, with no fuzzy-matching quality metrics
   reported.
10. **The agent hierarchy is one level deep and write-once.** A super agent's sub-agents are
    fixed at creation; adopting an existing agent into a downline is deliberately
    unsupported, which is what makes a parent cycle impossible (§5.4). A real distribution
    network will eventually need re-parenting, and that will need cycle detection over the
    whole chain rather than the one-level CHECK in `V58`.

> **Resolved since the first draft:** the June 2026 `AgentCashService` idempotency finding
> is **closed** — an explicit ownership guard at `AgentCashService:56` rejects a replayed
> key belonging to a different principal. **Invariant 8 (Finding F3) is also closed**: the
> super-agent tier it governs was built in `d35b9b59`, so the no-margin rule now governs
> live code and is enforced by `SuperAgentServiceTest`. All nine invariants hold
> unconditionally (§12.3).

### Security

> **The most important limitation in this chapter is new, and it is a withdrawn property
> rather than an unbuilt one.** Since 2026-09-02, user-to-user chat is **not end-to-end
> encrypted** for new messages: bodies are readable by the server so that history can follow
> the account rather than the device. §6.3.0 gives the mechanism, §12.4a the reasoning and
> the cost. Everything below that refers to E2EE properties now refers to pre-`a573783d`
> history, which remains per-device ciphertext on the server.

11. **AZA can read current user-to-user chat content.** Bodies are AES-256-GCM-encrypted at
    rest under `CHAT_CONTENT_KEY`, so a stolen database dump is ciphertext, but the operator
    holds the key. This is a deliberate trade for cross-device history, and it is the single
    largest reduction in the platform's security posture.
11b. **`CHAT_CONTENT_KEY` cannot be rotated.** There is no key-versioning scheme and no
    re-encryption pass, so rotating or losing it makes every existing message permanently
    unreadable — with no user-held material that could recover them. It is simultaneously a
    single point of failure for confidentiality *and* for availability, which is an
    uncomfortable combination worth stating plainly.
11c. **The safety-number UI is now a security signal that signals less than it appears to.**
    It still detects a substituted identity key, which matters for legacy history, but it no
    longer protects the content of new messages. Leaving it unchanged over a server-readable
    transport is a UI honesty problem, not a cryptographic one, and it is unresolved.
11d. **The per-file media key travels in the server-readable message body.** The media host
    (Cloudinary) still never holds a decryptable file, and the key is encrypted at rest, but
    AZA holds both halves.
11e. **No post-compromise security in the E2EE protocol.** A Double Ratchet is designed for
    but not implemented; v3 is wire-compatible with adding one — which is what would make an
    opt-in "secret chat" mode buildable on the retained implementation.
12. **Safety-number verification is optional and user-driven**, so the key-directory MITM
    is mitigated in principle but not in practice for most users.
13. **Audit anchors live in the same database they protect** — tampering is detectable, not
    prevented.
14. **Metadata is not protected** by E2EE: the social graph, timing and message sizes are
    visible to the operator.
15. **Support conversations were the original documented exception** (`ChatMessage.content`
    when `chat.isSupport`), necessarily readable so support agents can answer. Since the
    change above this is no longer an exception but the general case; the only thing that
    changed for support chats specifically is that their bodies are now encrypted at rest
    like everyone else's.
16. **4-digit transaction passcode**, 10⁴ search space. Verified policy: **5 attempts per
    rolling 5-minute window** per user in Redis, cleared on success. That is ~83 hours mean
    for an online exhaustive search — impractical, but a throttling argument rather than an
    entropy one, with **no escalating backoff and no permanent lockout**.
17. **Certificate pinning is root-CA level, not leaf.** Verified present on both platforms.
    The trade-off is deliberate (leaf pinning broke shipped builds twice), but it means the
    client trusts every certificate Let's Encrypt or Google Trust Services issues for the
    domain. The Android pin set expires **2027-08-01**, after which it degrades to standard
    CA validation — a safety valve that is also a scheduled weakening.
18. **The webhook SSRF guard is vulnerable to DNS rebinding** — the host is resolved once
    for validation and again by the HTTP client.

### Engineering

Seven of the twelve engineering limitations in the first draft have been closed. The closed
set is listed because the closures are themselves evidence for Chapter 3.

**Closed**

| Was | Now |
|---|---|
| No mobile CI job | `mobile-test` runs typecheck + 326 tests + coverage |
| Mobile suite not runnable | Restored; documented root-install requirement |
| Mobile app did not typecheck (893 errors) | 0 errors; **two live runtime bugs fixed** |
| No integration tests against real PostgreSQL | `MigrationChainIT`, `ConcurrentTransferIT` |
| Double-spend defence never demonstrated | Measured: 100 parallel debits, exactly 50 succeed |
| Non-canonical lock ordering (F1) | `WalletLocker`, 7 unit tests + a bidirectional IT |
| Effects fired pre-commit (F2) | `AfterCommitExecutor`, 5 unit tests |
| No backend coverage instrumentation | JaCoCo; money classes 61.7% lines over 17 classes (63.15% like-for-like) |
| Invariant 8 vacuous (F3) | Super-agent tier built; `SuperAgentServiceTest`, 17 tests |
| Deploy asserted nothing about health | Health poll + state + restart-counter gate |
| No backend test coverage for chat | Three new chat test classes |
| WebRTC calls could not traverse symmetric NAT | coturn actually running (§4.5) |
| Stores persisted globally across accounts | Account-scoped persistence (§7.4a) |

**Still open**

19. **Schedulers have no distributed lock** — no ShedLock, no leader election. All nine jobs
    would double-execute on a second instance, and auto-payout and hold-expiry are
    money-affecting. Unchanged.
20. **Maestro E2E flows are not in CI.** They need an emulator; a nightly job is the
    realistic answer, not per-push.
21. **No load or performance figures.** Correctness under concurrency is now measured
    (§12.5); throughput and latency are not. This is the largest remaining hole in
    Chapter 7.
22. **No automated security scanning in CI** — no dependency-vulnerability scan, no SAST, no
    secret scanning. `npm install` currently reports **13 high-severity advisories** in the
    mobile dependency tree, untriaged.
23. **Web apps have no unit tests** — lint and build only.
24. **No mutation testing**, so assertion strength is unmeasured.
25. **Deploy builds on the server** and uses **password SSH**. The healthcheck poll is now
    implemented (§10.2), but the GHCR + docker-rollout target is not — and the two remaining
    items are coupled, since a zero-downtime cutover needs a pre-built image to swap to.
26. **Mini-app workspaces are excluded from the CI typecheck** behind a documented stub. The
    proper fix is a shared tsconfig and hoisted dependencies for those workspaces.
27. **Three wallet writers took no row lock until 2026-09-06**, on paths no documented money
    flow passed through (promo credit, referral reward, float mint/burn). Closed structurally
    by `WalletLedger` (§5.4a), but recorded here because the *audit* that verified invariant
    4 in August did not find them — which bounds what a trace-based verification can claim.
27b. **No check that enum-backed `CHECK` constraints match their Java enums.** `V64` exists
    because one drifted and reached production, breaking the fraud hold (§6.7, §10.3).
28. **Coverage artefacts are tracked in git** (`aza/coverage/`), so every run produces
    thousands of lines of diff noise. They belong in `.gitignore`.

## 13.2 Future work

Ordered by value-per-effort — the first three are achievable before submission and
materially strengthen Chapter 7.

### Immediate (before submission)

The seven highest-value items from the first draft have been **done** — see §13.1. What
remains before submission:

1. **Run the load tests** and report p50/p95 for balance read, transfer and checkout
   creation. Correctness under concurrency is measured; performance is not, and Chapter 7
   currently has a visible hole where those numbers belong.
2. **Triage the 13 high-severity npm advisories**, and add `npm audit --audit-level=high`
   plus OWASP Dependency-Check to CI. Cheap, and it turns limitation 22 into a control.
3. **Add ShedLock** to the nine schedulers. It is a dependency and an annotation, and it
   removes the most consequential correctness constraint in the architecture (limitation 19).
4. **Add `collectCoverageFrom`** to the mobile Jest config so the coverage denominator is
   the codebase rather than the tested subset.
5. **Gitignore `aza/coverage/`.**
5b. **Add a schema-drift check** comparing enum-backed `CHECK` constraints against the
   current Java enums. Both `V58` and `V64` exist because one drifted from the other, and
   `V64`'s drift broke the fraud hold in production. A small script, high value.
6. **State the regulatory position** (§1.5) and the KYC-tier placeholder caveat explicitly.
7. **Verify the competitive comparison table** (§12.6) and cite the date checked.
8. **Document requirements elicitation** (§3.3), or justify the alternative.

Items 1–5 are engineering and can be finished in a day. Items 6–8 are yours to write and
cannot be delegated.

### Short term
5. **Key versioning and a re-encryption pass for `CHAT_CONTENT_KEY`.** Until this exists the
   key can never be rotated, and losing it destroys every message on the platform
   (limitation 11b). This is now the highest-priority security item, ahead of the ratchet,
   because it is an availability risk as well as a confidentiality one.
5b. **Opt-in "secret chat" mode**, restoring end-to-end encryption for conversations where
   the user chooses device-bound history over account-bound history — with the trade stated
   in the UI at the moment of choice. The whole implementation is retained (§6.3.1), so this
   is a product and UI problem more than a cryptographic one, and it is the honest
   resolution of the trade in §12.4a rather than a reversal of it.
5c. **Double Ratchet** on top of the existing X3DH v3 — post-compromise security, and the
   thing that would make a secret-chat mode worth the name.
5d. **Resolve the safety-number UI** (limitation 11c) so it does not imply a protection that
   current traffic does not have.
6. **Horizontal scalability**: switch on Redis fan-out, add ShedLock (or leader election)
   for the schedulers, verify with two instances behind nginx.
7. **GHCR + docker-rollout deployment** with healthcheck-gated cutover and key-based SSH.
8. **Security scanning in CI** — `npm audit`/OWASP Dependency-Check, a SAST pass, and
   secret scanning.
9. **Off-box audit anchoring** — publish the daily hash to append-only storage or a public
   ledger, converting tamper-*evidence* into tamper-*resistance*.
10. **Certificate pinning** in the mobile client.

### Medium term
11. **Mobile-money interoperability** — MTN MoMo, Telecel, AirtelTigo, and GhIPSS for bank
    transfers. The `PAYOUT` / `DISBURSEMENT` transaction types already reserve the space.
12. **Agent-hierarchy re-parenting**, with cycle detection over the whole chain. The
    super-agent tier itself is delivered (§5.4, §8.5); what remains is moving an existing
    agent between downlines, which is currently unsupported precisely because it is what
    makes cycles possible (limitation 10).
12b. **TURN under Compose.** coturn runs as a host service and the container definition is
    kept as the migration target; moving it requires disabling the host service first
    (§4.5). Also: issue a certificate for `TURN_HOST` so TURNS on 5349 serves clients on
    networks that permit only TLS.
13. **True double-entry ledger** with derived balances, retiring the reconciliation job.
14. **ML-based fraud detection** to complement the rule engine, with the existing
    `RiskDecisionLog` as training data — you already have the labelled dataset design.
15. **Offline/USSD channel** for feature phones, which is the honest answer to inclusion in
    the target market.

### Long term
16. Multi-currency and cross-border corridors (Nigeria, Kenya, Côte d'Ivoire).
17. Savings, credit and micro-insurance on top of the transaction history.
18. Merchant lending underwritten by settlement history.
19. Formal verification or a mechanised model of the money invariants.
20. Independent security audit and penetration test.

## 13.3 Conclusion — the argument to make

Do not conclude with a feature list. Conclude with the claim the artefact supports:

> An integrated platform combining private messaging with regulated e-money settlement is
> not only feasible but architecturally coherent, because the two requirements govern
> different objects: message *content* and value *movement* are separable, so the
> confidentiality of the first can be set independently of the auditability of the second.
> The engineering cost of that coherence is a small set of explicit, enforceable invariants
> — balanced movement, tenant-scoped idempotency, lock-based concurrency, dual control and
> an unbroken audit trail — and this work demonstrates that those invariants can be stated,
> mechanically reviewed, and maintained across a 250,000-line system and 62 schema
> migrations by a very small team, converging from six of nine holding unconditionally to
> nine of nine over two verification passes.

Note the deliberate weakening of that first sentence against the version this thesis
originally planned. The claim was "end-to-end encrypted messaging"; the system delivered
end-to-end encryption, ran it, and then **withdrew it** for cross-device history (§12.4a).
The revised claim is the one the artefact actually supports, and it is more interesting: the
separability of content confidentiality from value auditability is what made the *choice*
available at all. A design that had entangled the two would have had no choice to make.

The secondary claim, which the second verification pass earned and the first could not:

> An invariant enforced by construction is categorically stronger than one verified by
> inspection. Invariant 4 was verified as holding in August by tracing every documented
> money path; three wallet writers on undocumented paths took no lock. Routing every balance
> change through a single class that takes the lock at its entry point converted "we checked
> and it was fine" into "there is no way to write this wrong" — and that transformation, not
> the coverage percentage, is what the correctness argument rests on.

Then state what remains unproven — and be specific, because a precise limitation reads as
confidence and a vague one reads as evasion:

- **End-to-end confidentiality for current traffic.** Withdrawn deliberately on 2026-09-02
  in favour of account-owned history (§12.4a). The implementation is retained and an opt-in
  mode is specified (§13.2), but as the system stands the operator can read user-to-user
  chat.
- **Post-compromise security.** Not implemented even for legacy history; the protocol is
  designed to accept a Double Ratchet without breaking wire compatibility.
- **Horizontal scale.** The system is correct on one backend instance and not yet on two;
  both blockers (Redis fan-out, scheduler locking) are identified and bounded.
- **Performance under load.** Correctness under concurrency is now measured; throughput and
  latency are not.

Point at §13.2 for how each is closed. Note what *is* now proven, because the first draft of
this chapter could not say it: the double-spend defence is measured rather than argued, the
migration chain is verified against a real database, the cryptographic suite is behind an
automated gate, all nine money invariants hold unconditionally, and the most dangerous of
them is now enforced by a chokepoint rather than by convention.

And note the one thing this chapter should not do, which is present the E2EE withdrawal as a
failure. It was a capability that was designed, built, tested to 87.75% statement coverage,
deployed, and then traded for a property users needed more. **A thesis that reports only the
capabilities that survived contact with the product is reporting half the engineering.**


---

# 14. Glossary and Abbreviations

## Project terms

| Term | Meaning |
|---|---|
| **AZA** | The platform. Also the brand; the mobile app, backend and web surfaces all carry it. |
| **Akyede** | Ghanaian gifting feature (Akan *akyɛdeɛ*, "gift") — a red-envelope style money gift with expiry back to the sender. |
| **AZA Connect** | Marketplace product: one KYB'd platform pays many non-merchant sellers, by checkout split or direct transfer. |
| **AZA Pay** | The hosted checkout and mandate-approval surface at `pay.aza.systems`. |
| **Handle** | A user's `@username`; the primary human-readable payment address. |
| **Hold** | A checkout payment that does not settle at confirmation but waits for the integrator to call `release`. `release: AUTOMATIC \| MANUAL`. |
| **Mini App** | Third-party web app embedded in the AZA client's WebView via the `window.aza` bridge. |
| **Money request** | An in-chat request for payment. Settled as an ordinary transfer, so it is limit-checked identically. |
| **Netting / settle-up** | Collapsing several debts between two people into one request. |
| **Recipient invite** | A transfer addressed to someone with no AZA account, claimable on signup. |
| **Split** | A shared expense divided (equally or by weight) into per-participant money requests. |
| **Terminal ID** | Free-form label on a store QR identifying the till, branch or cashier. AZA stores and echoes it but never interprets it. |

## Domain terms

| Term | Meaning |
|---|---|
| **AML / CFT** | Anti-Money Laundering / Countering the Financing of Terrorism. |
| **BoG** | Bank of Ghana — the central bank and payments regulator. |
| **bps** | Basis points; 1 bp = 0.01%. Used for agent commission and merchant fee rates. |
| **Cash-in / cash-out** | Converting physical cash to wallet balance and back, via an agent. |
| **E-money** | Stored monetary value issued against received funds, redeemable at par. |
| **Float** | Liquidity an agent holds to serve cash-in and cash-out. |
| **Float distribution / recall** | A master agent pushing float down to a sub-agent, or pulling idle float back up. An internal `AGENT_FLOAT`→`AGENT_FLOAT` move: no e-money is created, and no margin is taken (invariant 8). |
| **GHS** | Ghanaian Cedi — the only currency AZA supports in v1. |
| **GhIPSS** | Ghana Interbank Payment and Settlement Systems. |
| **KYB** | Know Your Business — identity verification for a merchant. |
| **KYC** | Know Your Customer — identity verification for an individual. |
| **Maker–checker** | Dual control: the initiator of a privileged action cannot approve it. |
| **MDR** | Merchant Discount Rate — the fee a merchant pays on an accepted payment. |
| **Pricing plan** | The class of merchant pricing a fee rule applies to (`STANDARD`, …). Lets one versioned rule price a whole class of merchants; `merchants.fee_rate_bps` remains a per-merchant override that outranks the plan (V62). |
| **MNO** | Mobile Network Operator. |
| **MoMo** | Mobile Money — the MNO-issued e-money products dominant in Ghana. |
| **PEP** | Politically Exposed Person — a category attracting enhanced due diligence. |
| **Safeguarding** | Holding customer funds so that issued e-money is fully backed by segregated funds. |
| **Structuring / smurfing** | Splitting a large transfer into several smaller ones to stay under a reporting threshold. |
| **Super agent / master agent** | An agent of tier `SUPER` holding float and distributing it to the standard agents beneath it. Sub-agents are set at creation and cannot be re-parented (V58). |
| **Tiered KYC** | Graduated identity requirements with graduated limits. |
| **Velocity rule** | A monitoring rule on the count or value of transactions in a rolling window. |

## Technical terms

| Term | Meaning |
|---|---|
| **AAD** | Additional Authenticated Data — authenticated but not encrypted by AEAD; binds a ciphertext to its context. |
| **AEAD** | Authenticated Encryption with Associated Data (here, AES-256-GCM). |
| **Base32 (Crockford)** | 32-symbol encoding excluding I, L, O, U; used for the backup recovery key. |
| **BCrypt** | Adaptive password-hashing function. |
| **Double Ratchet** | Continuous key-ratcheting protocol providing post-compromise security. *Designed for, not implemented.* |
| **ECDH** | Elliptic-Curve Diffie–Hellman key agreement. |
| **Ed25519** | EdDSA signature scheme on Curve25519; used to sign pre-keys. |
| **E2EE** | End-to-End Encryption. In AZA this describes chat history sent **before 2026-09-02**; new messages are encrypted at rest under a server-held key instead (§6.3.0). |
| **Encryption at rest** | Data encrypted where it is stored, under a key the *operator* holds. Defends a stolen dump or backup; does not defend against the operator. Distinct from E2EE, and the distinction is load-bearing throughout Ch. 6 and 12. |
| **Flyway** | Versioned database migration tool. |
| **Forward secrecy** | Compromise of long-term keys does not expose past messages. |
| **HKDF** | HMAC-based Key Derivation Function (RFC 5869). |
| **HMAC** | Hash-based Message Authentication Code. |
| **HSTS** | HTTP Strict Transport Security. |
| **Idempotency key** | Client-supplied token making a repeated request safe to replay. |
| **IK / SPK / OPK / EK** | Identity Key / Signed Pre-Key / One-Time Pre-Key / Ephemeral Key. |
| **JPA / Hibernate** | Java Persistence API and its reference implementation. |
| **JWT** | JSON Web Token. |
| **OAuth 2.0 / PKCE** | Delegated authorisation framework / Proof Key for Code Exchange (RFC 7636). |
| **Pessimistic lock** | `SELECT … FOR UPDATE`; serialises concurrent access to a row. |
| **Read-modify-write race** | Two transactions read the same value, each computes from it, and one write is lost. The defect a pessimistic lock prevents, and the one three wallet writers were exposed to until `WalletLedger` (§5.4a). |
| **Post-compromise security** | Sessions self-heal after a key compromise ends. |
| **Safety number** | A hash of both parties' identity keys, compared out of band to detect a MITM. |
| **Redis Stream** | An append-only log with per-entry ids. Backs `WebSocketEventLog`, the durable per-user recovery log behind the live pub/sub transport (§4.5). |
| **At-least-once delivery** | A replayed event may arrive twice, so consumers dedupe on id. The delivery guarantee of the event log. |
| **STOMP** | Simple Text Oriented Messaging Protocol; here over WebSocket. |
| **TOTP** | Time-based One-Time Password (RFC 6238). |
| **coturn** | The TURN/STUN server implementation AZA runs, as a host service on the droplet. |
| **CGNAT** | Carrier-Grade NAT — many subscribers sharing one public IP. Why unauthenticated rate limits key on device before IP (§6.4), and why a TURN relay is required for calls (§4.5). |
| **Symmetric NAT** | A NAT that maps each destination to a different external port, defeating the hole-punching that lets two peers connect directly. Common on mobile carriers; the reason TURN is not optional. |
| **TURN** | Traversal Using Relays around NAT; relays WebRTC media when P2P fails. |
| **WebRTC** | Real-time peer-to-peer audio/video in the browser and on mobile. |
| **X25519** | ECDH function on Curve25519 (RFC 7748). |
| **X3DH** | Extended Triple Diffie-Hellman — asynchronous key agreement. |

## Technology versions (as at 2026-09-06)

| Component | Version |
|---|---|
| Java | 21 (Temurin) |
| Spring Boot | 4.0.6 |
| PostgreSQL | 16 |
| Redis | 7 (alpine) |
| Flyway | via `spring-boot-flyway` + `flyway-database-postgresql` |
| springdoc-openapi | 3.0.3 (must stay on 3.0.x for Boot 4) |
| jjwt | 0.12.6 |
| Firebase Admin | 9.3.0 |
| Cloudinary | 2.3.2 (http5) |
| AWS SDK S3 | 2.25.60 |
| React Native | 0.86.0 |
| Expo SDK | 57 |
| React | 19.2.x |
| Next.js | 16.2.6 |
| Tailwind CSS | 4 |
| TypeScript | 6.0.x (mobile), 5.x (web) |
| Node (CI) | 22 |
| `@noble/curves` / `ciphers` / `hashes` | 2.2.0 |


---

# 15. Figures, Tables and Appendices

A thesis is judged partly on its figures. Here is every diagram worth drawing, where its
source data lives, and which chapter it belongs in.

## 15.1 Figures to produce

| # | Figure | Source | Chapter |
|---|---|---|---|
| 1 | High-level system context (clients → nginx → backend → data → external services) | Mermaid in `02-architecture-and-backend.md` §4.1 | 4 |
| 2 | Deployment topology (Cloudflare / Vercel / droplet / mini-app origins) | Mermaid in §4.6 | 4 |
| 3 | Backend package/layer diagram | §4.3 tree | 4 |
| 4 | Request pipeline through the security filter chain | Mermaid in §4.3 | 4 |
| 5 | ER diagram — users, wallets, transactions, merchants, agents | Mermaid in `02-architecture-and-backend.md` §5.2; expand from `entity/` | 4 |
| 6 | ER diagram — chat, key bundles, ciphertexts, backups | `entity/Chat*`, `MessageCiphertext`, `UserKeyBundle` | 4 |
| 7 | ER diagram — merchant, checkout, splits, holds, settlements | `entity/Merchant*`, `CheckoutSession*`, `PaymentHold` | 4 |
| 8 | Transfer sequence diagram | Mermaid in §5.3 | 5 |
| 9 | Concurrency: two transfers serialising on a `FOR UPDATE` row lock | Draw from `WalletRepository` | 5 |
| 10 | State machine of `TransactionStatus` (8 states, incl. `HELD_FOR_REVIEW`) | `entity/Transaction.java` | 5 |
| 11 | KYC tier ladder with limits | `entity/KycTier.java` | 5 |
| 12 | Fee decision flow (free-per-txn → free-monthly → percentage → min/max cap) | `FeeCalculationService`, `V23` | 5 |
| 13 | Agent cash-in/cash-out flow, showing commission accrued as a payable not e-money | `V24__agents.sql`, `AgentCashService` | 5 |
| 14 | Safeguarding position: issued e-money vs safeguarded balance vs agent float | `SafeguardingSnapshot`, `WalletRepository` sums | 5 |
| 15 | **X3DH handshake** — IK/SPK/OPK/EK and the four DH operations | `aza/src/crypto/e2ee.ts` header | 6 |
| 16 | E2EE message envelope wire format | §6.3.1 | 6 |
| 17 | Key hierarchy and storage locations (device SecureStore vs server) | §6.3 table | 6 |
| 18 | Media encryption pipeline (capture → compress → encrypt → upload → decrypt at render) | `mediaCrypto.ts`, `useDecryptedMediaUri` | 6 |
| 19 | Audit anchor hash chain | `AuditAnchorService` | 6 |
| 20 | Threat model matrix as a diagram | §6.1 | 6 |
| 21 | Mobile navigation hierarchy | Mermaid in `03-security-clients-and-platform.md` | 5 |
| 22 | Provider composition order in the mobile app shell | `aza/src/providers/` | 5 |
| 23 | Hosted checkout sequence | Mermaid in `03-security-clients-and-platform.md` §9.2 | 5 |
| 24 | AZA Connect split vs direct transfer, with the money arithmetic | §9.3 | 5 |
| 25 | OAuth QR login sequence | §9.4 | 5 |
| 26 | Mini-app permission and consent flow | §9.5 | 5 |
| 27 | CI/CD pipeline | `.github/workflows/` | 6 |
| 28 | Flyway baselining: fresh DB vs adopted DB paths | §10.3 | 6 |
| 29 | Screenshot plate — mobile app key screens | Run the app; see below | 5/7 |
| 30 | Screenshot plate — admin, merchant and checkout surfaces | Run the web apps | 5/7 |
| 31 | Maker–checker asymmetry — restrictive actions immediate, permissive actions gated | `02-architecture-and-backend.md` §5.8 | 5 |
| 32 | E-money creation and destruction — `mint`/`burn` as the only paths that change total issuance | §5.5 | 5 |
| 33 | Certificate-pinning evolution — leaf pins (broke twice) → root-CA pins + expiry valve | `03-security-clients-and-platform.md` §6.5 | 5/6 |
| 34 | Multi-device ciphertext fan-out — one `MessageCiphertext` row per (message, device) | §6.3 | 5 |
| 41 | **Before/after: per-device E2EE fan-out vs a single server-encrypted body.** The single most important new figure. Two panels: (a) one message → N envelopes, none openable by device *n+1*; (b) one message → one `gcm1:` row, openable by any authenticated device. Annotate the arrow between them with what is gained (account-owned history, 0 key-bundle round trips) and what is lost (the operator can read it) | §6.3.0, §12.4a | 6/7 |
| 42 | Threat-model shift: T4 splits into T4a (stolen dump — still defended) and T4b (operator — no longer defended) | §6.1, §12.4 | 6 |
| 43 | **`WalletLedger` as a chokepoint** — twenty callers each taking their own lock (three forgetting) vs one entry point that takes it. The visual argument for enforcement-by-construction | §5.4a | 5/7 |
| 44 | Invariant conformance over three states: 6/9 → 8/9 → 9/9, with each transition labelled by its finding | §12.3 | 7 |
| 45 | Super-agent hierarchy and float distribution — master float → sub-agent float, annotated "no e-money created, no margin taken" | §5.4, `V58` | 5 |
| 46 | Merchant pricing resolution — merchant → plan → rule → band → cap, with the per-merchant override short-circuiting the chain | §5.2, `V62` | 5 |
| 47 | The durable event log — pub/sub as live transport, Redis Stream as recovery, client cursor replay | §4.5 | 4 |
| 48 | The deploy health gate — state check + restart-counter comparison across a settle window, and why neither alone suffices | §10.2 | 6 |
| 49 | The `V64` incident as a causal chain: enum value added → stale CHECK rejects UPDATE → risk-engine catch swallows it → transaction poisoned → unrelated INSERT fails → raw error on the PIN screen | §6.7 | 6/7 |
| 35 | Finding F1 — the deadlock cycle, and how canonical ordering removes it | `05-limitations-glossary-and-appendices.md` §16.2 | 6/7 |
| 36 | Finding F2 — effect timing before and after `AfterCommitExecutor` | §16.2 | 6/7 |
| 37 | **The concurrency experiment result** — 100 parallel debits, 50 succeed, balance 0 | `04-operations-testing-and-results.md` §12.5 | 7 |
| 38 | Coverage: whole backend vs money classes, side by side | §11.7 | 7 |
| 39 | The verification pass as a process — invariants → check → findings → fix → test | Ch. 3 + §16.1 | 3/7 |
| 40 | CI pipeline before and after the mobile job | `04-operations-testing-and-results.md` §10.1 | 6 |

**Diagram tooling.** The Mermaid blocks in these files render directly in GitHub, Typora,
Obsidian and VS Code, and export to SVG/PNG via `mmdc` (`@mermaid-js/mermaid-cli`) for
inclusion in LaTeX or Word. Keep the source in the repo so the figures stay reproducible.

## 15.2 Screenshots to capture

Aim for a two-page plate rather than a screenshot per page.

**Mobile (device frame, dark theme):** onboarding · home with balance · send flow
(contact → amount → confirm → PIN → success) · chat conversation with an in-chat payment ·
split creation · QR scan and merchant checkout · KYC ID capture · security settings
showing the 2FA methods · chat-info screen showing the **safety number** · mini-app hub and
a running mini app.

**Web:** admin dashboard · admin approvals queue (maker–checker) · admin risk/flagged
transactions · merchant dashboard · merchant API keys with live/test distinction ·
`aza-pay` checkout page · mandate approval page · developer API explorer · public
verification page.

## 15.3 Tables to include

| Table | Source |
|---|---|
| Scale of the artefact | `01-introduction-background-methodology.md` §1.7 |
| Technology stack with justification | `01-introduction-background-methodology.md` §3.2 |
| Deployable components | `02-architecture-and-backend.md` §4.2 |
| Principal types and their credentials | §4.4 |
| Security-relevant configuration defaults | §4.7 |
| Domain → entity → service map | `02-architecture-and-backend.md` §5.1 |
| Fee catalogue | §5.2 |
| KYC tier limits | §5.2 |
| **The nine financial invariants** | §5.4 |
| Agent commission parameters | §5.5 |
| Threat model | `03-security-clients-and-platform.md` §6.1 |
| Key hierarchy | §6.3 |
| Application security controls | §6.4 |
| Mobile feature domains and screen counts | `03-security-clients-and-platform.md` §7.2 |
| Mini-app permissions | `03-security-clients-and-platform.md` §9.5 |
| Migration failure modes encountered | `04-operations-testing-and-results.md` §10.3 |
| Backend test inventory | `04-operations-testing-and-results.md` §11.2 |
| Requirements traceability matrix | `04-operations-testing-and-results.md` §12.1 |
| Invariant conformance | §12.3 |
| Performance results | §12.5 |
| Competitive comparison | §12.6 |
| Limitations | `05-limitations-glossary-and-appendices.md` §13.1 |
| **Verification summary — 18 checks, 5 findings, 4 fixed** | `05-limitations-glossary-and-appendices.md` §16.1 |
| Concurrency experiment results | `04-operations-testing-and-results.md` §12.5 |
| Coverage — backend aggregate vs money classes, at both measurement dates | `04-operations-testing-and-results.md` §11.7 |
| Verification findings F1–F10, both passes, with verdict and remedy | `05-limitations-glossary-and-appendices.md` §16.1, §16.6 |
| Deliverable counts at both measurement dates | `04-operations-testing-and-results.md` §12.2 |
| Maker–checker action inventory (18 actions × approver role) | `02-architecture-and-backend.md` §5.8 |
| Webhook delivery properties | `03-security-clients-and-platform.md` §9.6 |
| Measured development history (694 commits, commit-type distribution) | `01-introduction-background-methodology.md` §3.1 |

## 15.4 Appendices

| Appendix | Content | Source |
|---|---|---|
| A | Full API endpoint listing | `mvn spring-boot:run` then `GET /v3/api-docs`, or enumerate `controller/` |
| B | Complete database schema | Concatenate `backend/src/main/resources/db/migration/*.sql`, or `pg_dump --schema-only` |
| C | E2EE protocol specification (retained; governs stored history) | `aza/src/crypto/e2ee.ts` + §6.3.1 |
| C2 | At-rest message cipher specification | `MessageContentCipher.java` + §6.3.0 |
| D | The nine money invariants and the review method | `.claude/skills/money-path-review/SKILL.md` |
| E | Developer integration guides | `docs/AZA_CONNECT.md`, `SIGN_IN_WITH_AZA.md`, `miniapps/aza-sdk/docs/` |
| F | Design record: payment holds | `HELD_SETTLEMENT_PLAN.md` |
| G | Test inventory and coverage reports | §11.2; generated JaCoCo / Jest reports |
| H | Postman collections | `docs/AZA_Backend.postman_collection.json`, `docs/aza-connect.postman_collection.json` |
| I | Deployment and operations runbook | `04-operations-testing-and-results.md`, `backend/docs/SECRETS_ROTATION.md` |
| **J** | **Verification log** — 18 mechanical checks with commands, results, five findings and the commit that closed each | `05-limitations-glossary-and-appendices.md` |
| **K** | Commit history for the remediation — seven slices, each stating the failure scenario | `git log --oneline d290807..008055d` |

## 15.5 Commands to regenerate the evidence

```bash
# Line counts
find backend/src/main/java -name '*.java' | xargs wc -l | tail -1
find aza/src \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
for a in aza-web aza-admin aza-merchants aza-pay; do
  printf '%s: ' "$a"; find "$a/src" \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
done

# Component counts
ls backend/src/main/java/com/aza/backend/{controller,service,entity,repository} | wc -l
find backend/src/main/java/com/aza/backend/dto -name '*.java' | wc -l
ls backend/src/main/resources/db/migration | wc -l
find aza/src -name '*Screen.tsx' | wc -l

# Tests
find backend/src/test -name '*.java' | wc -l
find aza/src -name '*.test.ts*' | wc -l
ls aza/maestro/*.yaml | wc -l

# Schema dump for Appendix B
cat backend/src/main/resources/db/migration/*.sql > /tmp/aza-schema.sql

# OpenAPI spec for Appendix A
curl -s https://api.aza.systems/v3/api-docs | python3 -m json.tool > /tmp/aza-openapi.json

# Render Mermaid figures
npx -y @mermaid-js/mermaid-cli -i docs/thesis/02-architecture-and-backend.md -o figures/arch.svg
```

## 15.6 Writing checklist

- [ ] Every **[FILL IN]** in these files is resolved or explicitly deferred in-text.
- [ ] Every ✘ in the competitive table (§12.6) is verified, with the date checked.
- [ ] The KYC tier figures carry the "placeholder, confirm against BoG" caveat.
- [ ] The regulatory-status position (§1.5) is stated unambiguously.
- [ ] Cryptographic claims state what is **not** achieved (no post-compromise security)
      alongside what is.
- [ ] Every code reference uses `path:line` and the line still points at what you claim.
- [ ] The concurrency experiment (§12.5) has been run, or its absence is stated.
- [ ] Figures are exported at print resolution and legible in greyscale.
- [ ] Secrets, tokens, keys and real customer data appear nowhere in the document or its
      screenshots — redact before you paste.


---

# 16. Verification Log

Every claim in this documentation set that could be checked mechanically was checked on
**2026-08-21** against commit `8440c51` (branch `Home`), and **re-verified on 2026-09-06**
against commit `9678fa5a` (branch `main`). This file records the command, the result and the
verdict, so the thesis can cite verification rather than assertion — and so a marker can
re-run it.

The first pass produced **three findings in the backend and two latent runtime bugs in the
mobile client**. All five have since been **fixed and covered by tests**; the original
diagnosis is kept below alongside the remedy, because the diagnosis is the part with thesis
value.

The second pass (§16.6) closed the last open finding, found three wallet writers the first
pass had missed, and recorded one deliberate **reduction** in a verified property — the
withdrawal of end-to-end encryption for new chat messages. A verification log that only ever
records improvements is not a log, it is a changelog.

> **Read this as a narrative, not a checklist.** The sequence — write down the invariants,
> check them mechanically, find that two of nine did not hold, fix them, prove the fix with
> a test — *is* the methodological contribution of Chapter 3. A verification pass that finds
> nothing demonstrates nothing.

---

## 16.1 Summary

| # | Claim under test | Verdict at audit (2026-08-21) | Status now (2026-09-06) |
|---|---|---|---|
| V1 | `AgentCashService` idempotency is tenant-scoped | ✅ Closed — ownership guard present | ✅ |
| V2 | Wallet locks are acquired in a canonical order | ⚠️ **F1** — only in `AgentCashService` | ✅ **Fixed** — shared `WalletLocker`, 7 tests |
| V3 | Passcode brute force is throttled | ✅ 5 attempts / 5-minute Redis window | ✅ |
| V4 | The mobile client pins certificates | ✅ Root-CA pinning, both platforms, expiry valve | ✅ |
| V5 | Webhooks are signed, retried, SSRF-guarded | ✅ HMAC-SHA256, 7 attempts, private-address rejection | ✅ |
| V6 | Invariant 5 — `BigDecimal` only near money | ✅ No `double`/`float` on any amount | ✅ + schema-level assertion |
| V7 | Invariant 7 — GHS-only, no FX path | ✅ No FX code, no non-GHS literals | ✅ |
| V8 | Invariant 2 — effects fire after the debit **commits** | ⚠️ **F2** — effects fired pre-commit | ✅ **Fixed** — `AfterCommitExecutor`, 5 tests |
| V9 | Invariant 8 — no margin on super-agent float | ⚠️ **F3** — governs code that no longer exists | ✅ **Fixed** — tier built, `SuperAgentServiceTest` (17 tests) |
| V10 | Maker–checker rejects self-approval | ✅ Rejected outright, including for ADMIN | ✅ |
| V11 | No `.env` was ever committed | ✅ Clean across all history | ✅ |
| V12 | Backend test suite passes | ✅ 355 tests, 36 classes | ✅ **509 tests, 53 classes, 0 failures** |
| V13 | Mobile test suite runs | ⚠️ Not runnable; **no mobile CI job** | ✅ **Fixed** — **326 tests, 24 suites**, CI job added |
| V14 | Schedulers safe on multiple instances | ❌ No ShedLock or leader election | ⚠️ Unchanged — single-instance by design |
| V15 | Mobile app typechecks | ⚠️ **893 errors**; 2 were live runtime bugs | ✅ **Fixed** — 0 errors, typecheck in CI |
| V16 | Migrations apply to an empty database | ⚠️ Never tested — H2 only | ✅ **Fixed** — `MigrationChainIT` on real PostgreSQL |
| V17 | Concurrent debits cannot double-spend | ⚠️ Argued, never demonstrated | ✅ **Fixed** — `ConcurrentTransferIT`, measured |
| V18 | Backend coverage is instrumented | ❌ No JaCoCo | ✅ **Fixed** — money classes 61.7% lines over 17 classes |
| V19 | Invariant 4 — **every** wallet writer takes a row lock | *(not asked in this form)* | ⚠️ **F6 at re-verification** — three writers did not; ✅ closed structurally by `WalletLedger` |
| V20 | Invariant 3 — every money-moving endpoint has an idempotency key | *(checked per-endpoint in pass 1)* | ⚠️ **F7** — three gaps (float mint, user withdrawal, recurring transfer); ✅ all closed |
| V21 | Chat content is unreadable to the server | ✅ True at audit — per-device E2EE | ❌ **No longer true, by design** — see F8 |
| V22 | The deploy fails when a service is not running | *(not asked in pass 1)* | ⚠️ **F9** — `docker compose ps` was printed, never read; ✅ closed |
| V23 | A TURN relay is actually running | *(not asked in pass 1)* | ⚠️ **F10** — credentials signed against a service that did not exist; ✅ closed |

---

## 16.2 Findings

### F1 — Wallet lock ordering is not canonical in `TransferService`

**Severity:** MEDIUM (availability, not correctness — no money is lost)

`AgentCashService` acquires its two wallet locks in a deterministic order, comparing UUIDs
first:

```java
// service/AgentCashService.java:253
private WalletPair lockFloatAndCustomer(UUID agentUserId, UUID customerId) {
    if (agentUserId.compareTo(customerId) < 0) {
        agentWallet    = lockFloat(agentUserId);
        customerWallet = lockPersonal(customerId);
    } else {
        customerWallet = lockPersonal(customerId);
        agentWallet    = lockFloat(agentUserId);
    }
    ...
}
```

`TransferService` does not. At every lock site it takes the **sender** first, then the
**recipient**, in request order:

| Site | Lines |
|---|---|
| Transfer confirmation | `TransferService.java:340`, `:468` |
| Held-transfer release | `:581`, `:584` |
| Money-request acceptance | `:847`, `:849` |
| Bulk transfer | `:1266`, `:1279` |

**Failure scenario.** A sends to B while B sends to A, concurrently. Transaction 1 locks
A then waits on B; transaction 2 locks B then waits on A. PostgreSQL detects the cycle and
aborts one with a deadlock error (SQLSTATE 40P01), surfacing to the user as a failed
transfer. No money is lost or created — invariant 4 holds — but a legitimate transfer fails
under a condition that is entirely avoidable.

### ✅ F1 — Fixed

`WalletLocker` (`service/WalletLocker.java`) now owns the ordering for every money path:

```java
public Locked lock(Target first, Target second) {
    if (first.order(second) < 0) {
        Wallet a = lockOne(first);
        Wallet b = lockOne(second);
        return new Locked(a, b);
    }
    // Lock the second one first; the caller still gets (first, second) back.
    Wallet b = lockOne(second);
    Wallet a = lockOne(first);
    return new Locked(a, b);
}
```

Three design points worth reproducing in Chapter 5:

1. **The sort key is `(userId, type)`, not `userId`.** An agent holds both a PERSONAL and
   an AGENT_FLOAT wallet, so a user id alone does not identify a wallet row. The original
   `AgentCashService` version compared user ids only, which happened to be safe there
   because the two wallets always belonged to different users — but would not generalise.
2. **`Locked` returns the wallets in the order they were *requested*.** Call sites never
   have to reason about which was acquired first, which is what makes the helper adoptable
   rather than a source of new bugs.
3. **`AgentCashService` was refactored onto the shared helper** rather than keeping its own
   copy. Two implementations of the same invariant is how a fix drifts back out.

Applied at all four `TransferService` sites plus both `AgentCashService` paths.
`AgentCashService`'s private ordering helper was deleted.

**Proof.** `WalletLockerTest` — 7 tests. The strongest is
`orderingIsStableAcrossEveryPairingOfManyIds`, which asserts that for *every* ordered pair
drawn from a set of ids, the acquisition sequence depends only on the pair and never on the
request order. That caller-independent total order is precisely what makes a lock cycle
impossible. `ConcurrentTransferIT.bidirectionalTransfers_doNotDeadlock` then drives 60
alternating A→B / B→A transfers in parallel against real PostgreSQL and asserts zero
SQLSTATE 40P01 aborts.

**A genuine subtlety the test surfaced.** `UUID.compareTo` compares the high 64 bits as a
**signed** long, so `ffffffff-…` sorts *before* `00000000-…` — it is not byte order. This
does not matter for deadlock avoidance (any total order works, provided every caller uses
the same one), but it is a good example of an assumption that reads as obviously true and
is not. `WalletLockerTest.uuidComparisonIsSigned_whichIsWhyOrderIsDerivedNotAssumed` pins it.

**Thesis value.** The codebase already contained the correct pattern in one service and not
in another — a concrete illustration of why an invariant needs a *mechanical* review gate
rather than developer memory. That is the argument of Chapter 3, evidenced.

---

### F2 — External effects fire before commit in `TransferService`

**Severity:** MEDIUM (invariant 2, second half)

Invariant 2 says the wallet debit commits before any external side effect. The *ordering* is
correct — the debit, credit and ledger write all precede the notifications — but the
notifications are issued **inside** the `@Transactional` method, so they are sent before the
transaction commits:

```java
// service/TransferService.java:429 onward, still inside @Transactional
transactionRepository.save(transaction);
riskEngineService.evaluateTransfer(transaction, sender);
webSocketPublisher.publishNotification(...);
notificationService.sendMoneyReceivedNotification(...);
emailService.sendTransferSentEmail(...);
smsService.sendTransferSentSms(...);
```

**Failure scenario.** Any exception or constraint violation after this point — or a
connection failure at commit — rolls the transfer back while the recipient has already
received a push notification, an SMS and an email announcing money that never arrived. The
inverse failure (money moves, no notification) is prevented; this one is not. Network I/O
also holds the database transaction open for the duration of four provider calls, which
lengthens the window during which the wallet rows stay locked — a second-order effect on
throughput.

**The fix already exists in this codebase.** `ChatService` has precisely the right helper,
with precisely the right rationale:

```java
// service/ChatService.java:719
/**
 * Run {@code action} after the current transaction commits — or immediately
 * if no transaction is active — so we never publish/notify for a message that
 * later rolls back, and keep network I/O out of the DB transaction window.
 */
private void runAfterCommit(Runnable action) { ... }
```

### ✅ F2 — Fixed

`AfterCommitExecutor` (`service/AfterCommitExecutor.java`) generalises the chat helper:

```java
public void run(Runnable action) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
        execute(action);          // no transaction — behave identically
        return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override public void afterCommit() { execute(action); }
    });
}
```

Applied to all four effect blocks in `TransferService`: merchant payment, P2P transfer,
released hold, and accepted money request.

Three decisions worth explaining, because each is a real trade-off:

1. **Only genuinely external effects were deferred.** `riskEngineService.evaluateTransfer`
   and `feeCalculationService.recordMonthlyUsage` write to AZA's own tables and therefore
   stay *inside* the transaction, alongside the ledger record — invariant 9 requires
   exactly that. Invariant 2 is about effects that leave the building.
2. **Reads stay inside; only sends are deferred.** The merchant notification-preference
   lookup and the merchant-owner fetch happen while the entities are still managed, and
   balances are captured into locals before the lambda. Deferring the reads too would have
   worked, but would have opened a second transaction per notification.
3. **Failures in the deferred action are logged and swallowed.** The money has already
   moved and the transaction is closed; throwing would achieve nothing except an error no
   caller can act on. A failed SMS must not be able to appear to undo a committed transfer.

**Proof.** `AfterCommitExecutorTest` — 5 tests, including
`neverFires_whenTheTransactionRollsBack`, which is the exact failure this component exists
to prevent, and `swallowsFailures_soAFailedNotificationCannotUndoACommittedTransfer`.

**Thesis value.** The chat path got this right and the money path did not — same codebase,
same authors, same week. Use it in the discussion: an invariant that is *understood* is not
the same as an invariant that is *enforced*. That gap is the argument for the review gate,
and this is the cleanest evidence of it in the repository.

---

### F3 — Invariant 8 governs code that no longer exists ✅ *(closed 2026-09-06 — see §16.6)*

**Severity:** LOW (documentation drift, not a defect)

Invariant 8 states that SUPER-tier float distribution must carry no margin. Checking it:

- `SuperAgentService` **no longer exists** in `backend/src/` (a stale
  `SuperAgentServiceTest` surefire report from a previous run is the only trace).
- `Agent.Tier.SUPER` is **declared but never referenced** anywhere in `service/` or
  `controller/`.
- `FloatService` — the surviving float code — contains **no fee, commission, margin or bps
  logic at all**. It exposes only `mint`, `burn` and `list`.

So the invariant is currently vacuous: there is no float-distribution path for it to
govern. It is not violated; there is simply nothing to violate.

**How to handle it in the thesis.** Do not quietly drop it to make the list nine-for-nine.
State that the super-agent tier is designed and its safety rule written, but the
implementation was removed pending the super-agent portal (`aza-superagents` is an empty
scaffold), and the invariant is retained as a **forward constraint** on that future work.
That is a more interesting and more honest position than either claiming compliance or
pretending the invariant was never written.

---

### F4 — The mobile app did not typecheck, and two of the errors were live bugs

**Severity:** HIGH (two runtime defects reaching users)

With no mobile CI job, `npx tsc --noEmit` had evidently not been run in some time. It
reported **893 errors**. The distribution is the interesting part:

| Cause | Count | Nature |
|---|---|---|
| Missing `jest` types in `__tests__` | 832 | Noise — one tsconfig line |
| `Buffer` used in crypto tests | 20 | Noise — Node global absent from RN |
| `NodeJS.Timeout` type annotation | 12 | Noise — Node namespace absent from RN |
| **`StyleSheet.absoluteFillObject`** | **18** | **Live runtime bug** |
| **`Clipboard.setString`** | **1** | **Live runtime bug** |
| `exactOptionalPropertyTypes` mismatches | 3 | Real, narrow |
| Sibling-workspace module resolution | 27 | Environmental |

**The two real ones are worth writing up as a case study in what a type system buys you.**

*`StyleSheet.absoluteFillObject` (18 call sites).* This property **does not exist in React
Native 0.86** — not in the types and not at runtime. Every one of the 18 sites reads
`{ ...StyleSheet.absoluteFillObject, … }`, and spreading `undefined` in JavaScript is
silently legal: it contributes nothing. So eighteen overlays — the KYC ID-scan and selfie
frames, the chat forward modal, the image cropper, the drawing canvas, the agent QR
scanner, several modal backdrops — **silently lost their absolute positioning** in the
RN 0.86 upgrade. No crash, no error, no test failure: just overlays that no longer cover
what they are meant to cover. Fixed by replacing with `StyleSheet.absoluteFill`, which is
declared as exactly the same object shape (`position:'absolute'; left:0; right:0; top:0;
bottom:0`) and so is a drop-in.

*`Clipboard.setString` (1 call site).* `expo-clipboard` exposes only `setStringAsync`;
there is no synchronous setter. The call therefore threw a `TypeError` every time a user
tapped **Copy** on the bill-forwarding email address. The line immediately below it in the
same function already used `setStringAsync` correctly, which is what makes it a textbook
example: a human reviewer's eye slides straight over it, and a typechecker cannot miss it.

**This is the strongest single argument in the thesis for the CI gap being consequential.**
Both defects are invisible to unit tests (nothing asserts on style objects), invisible in
review, and invisible at build time — Metro strips types without checking them. Only a
typechecker finds them, and nothing was running one.

**Fixed:** 893 → **0**. `tsconfig.json` gains `"types": ["jest"]` and an
`ignoreDeprecations` note explaining why `baseUrl` cannot simply be dropped;
`NodeJS.Timeout` became `ReturnType<typeof setTimeout>`; `Buffer` became a three-line local
hex helper; the three optional-property mismatches were widened at the *declaration* side
(behaviour-neutral). The 27 workspace-resolution errors are contained by `tsconfig.ci.json`
plus a documented stub — see §16.3 V15.

---

### F5 — Nothing in CI ran the mobile app

**Severity:** HIGH (process)

Covered in §16.3 V13. Fixed: a `mobile-test` job now runs typecheck, the 254 Jest tests,
and uploads coverage.

---

## 16.3 Resolved items — full detail

### V1 · `AgentCashService` idempotency is tenant-scoped ✅

The June 2026 audit flagged this as open. It is now closed. Keys are globally unique across
the `transactions` table, so replay protection alone would let one agent read another's
transaction by guessing a key. The service adds an explicit ownership guard:

```java
// service/AgentCashService.java:56
Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
if (existing.isPresent()) {
    // Ownership guard: keys are globally unique across the transactions table,
    // so a replayed key must belong to THIS agent's cash-in (agent is sender)
    // or it would leak another user's transaction details.
    if (!existing.get().getSenderId().equals(agentUser.getId())) {
        throw new AppException("INVALID_IDEMPOTENCY_KEY", "Invalid idempotency key", HttpStatus.CONFLICT);
    }
    return toResponse(existing.get(), agentForUser(agentUser));
}
```

Note the design nuance worth writing up: there are **two valid ways** to scope idempotency,
and the codebase uses both deliberately.

| Approach | Where | Mechanism |
|---|---|---|
| **Scoped key** | Checkout (V43), Connect (`UNIQUE(merchant_id, idempotency_key)`) | The tenant is part of the uniqueness constraint, so two tenants may reuse the same key value independently |
| **Global key + ownership guard** | `AgentCashService` | One global namespace; a replay by a different principal is rejected at read time |

The scoped-key approach is better where integrators choose their own key values (they will
collide). The ownership guard is adequate where the key namespace is already effectively
unique. Both close the leak; the thesis should present the trade-off rather than treating
one as the only correct answer.

### V3 · Passcode throttling ✅

```java
// service/UserService.java:638
String attemptsKey = "pin:attempts:" + user.getId();
int attempts = ...;
if (attempts >= 5) {
    throw new AppException("Too many failed attempts. Try again in 5 minutes.");
}
if (!passwordEncoder.matches(passcode, user.getPasscodeHash())) {
    redisTemplate.opsForValue().set(attemptsKey, String.valueOf(attempts + 1), 5, TimeUnit.MINUTES);
    throw new AppException("Invalid passcode.");
}
redisTemplate.delete(attemptsKey);
```

**5 attempts per 5-minute rolling window, per user, in Redis; the counter is cleared on
success.** The passcode itself is BCrypt-hashed, not stored.

Be precise about the resulting security margin in Chapter 6, because it is a fair question:
a 4-digit passcode has 10⁴ = 10,000 possibilities, and 5 attempts per 5 minutes is 60
attempts per hour, so an online exhaustive search averages ~83 hours and worst-cases at
~167 hours — long enough to be impractical and to be noticed, but this is a *throttling*
argument, not an entropy argument. The passcode is a second factor on an
already-authenticated session on an already-unlocked device, not a standalone credential.
Note also that the counter has no escalating backoff and no permanent lockout, so the
attacker's rate never degrades.

Related: passcode reset is separately rate-limited to 3 attempts per 10 minutes
(`AuthService.java:535`) and requires an emailed OTP.

### V4 · Certificate pinning ✅ — and a genuinely good case study

Implemented as an Expo config plugin (`aza/plugins/withSslPinning.js`), applied at the
**native** layer on both platforms — Android Network Security Config and iOS
`NSPinnedDomains` — so *all* traffic is covered (Axios, `fetch`, and the WebSocket) without
any JavaScript involvement.

**Write this one up properly; it is a real engineering narrative.** The first
implementation pinned the Let's Encrypt **leaf** key plus one intermediate. That broke
shipped builds twice:

1. Let's Encrypt renews the leaf — with a new key — roughly every 90 days.
2. The domain is proxied through Cloudflare, which serves its own edge certificate and
   rotates both the certificate and the issuing CA at will.

And a native pin **cannot be fixed by an OTA update**, so a mismatch bricks the app for
every installed user until they download a new binary. In a payments app, that is an outage.

The current strategy (changed 2026-07) pins the **root CAs** of the two authorities
Cloudflare issues from for this zone — six SPKI-SHA256 pins across ISRG Root X1/X2
(Let's Encrypt) and GTS Root R1–R4 (Google). Root keys are stable for a decade or more,
while validation still rejects any certificate that does not chain to one of those specific
roots — which closes the usual MITM path, a mis-issued certificate from some other public CA.

Two supporting controls make the design safe rather than merely clever, and both belong in
the write-up:

- **A coupled ops control.** Cloudflare Universal SSL must be restricted to the same CAs
  (`PATCH /zones/{zone}/ssl/universal/settings {"certificate_authority":"lets_encrypt"}`),
  or an edge certificate from a third CA would appear and fail validation. The pin set and
  the CDN configuration are a single system; changing one without the other is an outage.
- **An expiry safety valve.** The Android `<pin-set>` carries `expiration="2027-08-01"`.
  After that date, pinning **degrades to standard CA validation instead of hard-failing** —
  a deliberate choice that a forgotten update can never again brick payments.

There is also a verification script, `node scripts/check-pins.js`, to check the live chain
against the pin set.

The trade-off to state honestly: root-CA pinning is materially weaker than leaf pinning —
it trusts every certificate those two CAs issue for this domain, so it does not defend
against an attacker who can compel or compromise Let's Encrypt or Google Trust Services.
It defends against the realistic threat (a rogue or mis-issuing third-party CA, a
locally-installed interception root) while remaining operable. That is the right call for
this system, and saying *why* is what makes it a thesis contribution rather than a
checkbox.

### V5 · Webhook delivery ✅

`service/WebhookService.java`:

| Property | Implementation |
|---|---|
| Signature | HMAC-SHA256 over the raw payload with the endpoint's `signingSecret`, sent as `X-Aza-Signature: sha256=<hex>` |
| Correlation headers | `X-Aza-Event` (event type), `X-Aza-Delivery` (delivery UUID, for idempotent consumption) |
| Retry schedule | 7 attempts at 5s → 30s → 5m → 30m → 2h → 6h → 24h, then `ABANDONED` |
| Success criterion | HTTP 2xx; anything else schedules a retry |
| Timeouts | 10s connect, 15s request |
| Persistence | Every attempt recorded on `WebhookDelivery` — attempt count, last attempt, response status, first 500 bytes of the response body |
| Subscription | Opt-in per endpoint; an endpoint receives an event only if its `events` list names it or is `*` |
| **SSRF guard** | `validateWebhookUrl` requires HTTPS and rejects any URL resolving to a loopback, site-local, link-local or any-local address |

The SSRF guard is worth highlighting: a webhook endpoint is a user-supplied URL that the
server fetches, which is the textbook SSRF primitive. Rejecting private address space stops
a merchant pointing an endpoint at `169.254.169.254` (cloud metadata) or an internal
service. Note the residual weakness for completeness — the check resolves the host once and
the HTTP client resolves it again, so a DNS-rebinding attacker could in principle exploit
the gap between the two.

### V6 · `BigDecimal` only ✅

```bash
grep -rnE "\b(double|float)\s+\w*([Aa]mount|[Bb]alance|[Ff]ee|[Pp]rice|[Tt]otal)" service/ entity/ dto/
# → no matches

grep -rnE "private (double|float|Double|Float) " entity/
# → entity/RiskDecisionLog.java:40:  private Double anomalyScore;
# → entity/Transaction.java:121:     private Double anomalyScore;
```

The only floating-point fields in the entity layer are `anomalyScore` — a risk score, not
an amount. Every monetary column is `NUMERIC(15,2)` and every monetary field is
`BigDecimal`. **Invariant 5 holds.**

### V7 · GHS-only scope ✅

```bash
grep -rniE "exchangeRate|currencyConver|fxRate|convertCurrency" backend/src/main/java   # → none
grep -rn '"USD"\|"EUR"\|"NGN"\|"KES"' backend/src/main/java                             # → none
```

No FX code path and no non-GHS currency literal anywhere in the backend. `Wallet.currency`
and `ConnectTransfer.currency` both default to `GHS`. **Invariant 7 holds.**

### V10 · Maker–checker ✅

`service/ApprovalService.java` — the class comment states the rule and the code enforces it:

```java
if (approval.getRequestedBy().equals(approver.getId())) {
    throw new AppException("SELF_APPROVAL", "You cannot approve your own request", HttpStatus.FORBIDDEN);
}
```

Self-approval is rejected outright, **including for ADMINs** — the comment notes that
otherwise "the control is decorative". The approver must additionally hold the action's
owning role, requests expire after 7 days, the submission alerts the owning role, and both
submission and approval are written to the admin audit log. Full action inventory in §5.8.

### V11 · No committed secrets ✅

```bash
git log --all --full-history --oneline -- '**/.env' '.env'   # → no output
```

No `.env` file appears anywhere in the history of any branch. The Firebase service-account
JSON is mounted at deploy time rather than baked into an image, and the Cloudflare DNS-01
token lives in a gitignored `./secrets` mount.

### V12 · Backend suite ✅ — measured, before and after

```bash
cd backend && mvn -q test -Dsurefire.excludes="**/*ApplicationTests.java"
```

| | At audit | After the fixes |
|---|---|---|
| Tests | 355 | **374** |
| Test classes | 36 | **40** |
| Failures / errors | 0 / 0 | **0 / 0** |
| Skipped | 0 | 7 (the Docker-gated integration tests) |

The 19 new tests are `WalletLockerTest` (7), `AfterCommitExecutorTest` (5),
`MigrationChainIT` (4) and `ConcurrentTransferIT` (3). Runtime ≈ 2 minutes on an
Apple-silicon laptop without Docker.

**On the 7 skipped:** the integration tests are annotated
`@Testcontainers(disabledWithoutDocker = true)`, so they skip on a machine with no Docker
daemon and run in CI, where one is always present. **Skipped is not passed** — quote the CI
result, not a local run, when reporting them.

Aggregate it yourself with:
```bash
cat backend/target/surefire-reports/*.txt | grep -E "^Tests run" \
  | awk -F'[:,]' '{t+=$2;f+=$4;e+=$6;s+=$8} END {printf "Tests %d, Fail %d, Err %d, Skip %d\n",t,f,e,s}'
```

### V13 · Mobile suite ✅ — restored, and now gated

**Originally:** could not be run at all, and nothing in CI touched it.

**The original diagnosis:**


Two separate problems.

**(a) Not runnable in this working copy.** `npm test` fails at config load:

```
Error: The React Native Jest preset that jest-expo relies on has moved to a separate package.
To migrate, please install "@react-native/jest-preset" to fulfill jest-expo's peer dependency.
    at jest.config.js:8
```

`@react-native/jest-preset` is declared in `aza/package.json` devDependencies (`^0.86.2`)
but is present in **neither** `node_modules/@react-native/jest-preset` nor
`aza/node_modules/@react-native/jest-preset`. This is an install-state problem, not a code
defect — the repo carries an elaborate `aza/jest/moduleFallback.js` shim precisely because
npm workspaces hoist this package to the root. Fix with `npm install` from the repository
root, then re-run `npm test -- --coverage` inside `aza/`.

**(b) The mobile app has no CI job at all.** `.github/workflows/ci.yml` defines
`backend-test`, `backend-docker` and `frontend-ci` — and `frontend-ci`'s matrix covers only
`aza-web`, `aza-admin`, `aza-merchants` and `aza-pay`. Nothing runs the mobile app's
TypeScript check, its 17 Jest suites, or its 20 Maestro flows.

**This is the most consequential finding in the log**, because the mobile suite is what
tests the cryptography — `x3dh.test.ts`, `e2ee.test.ts`, `keystore.test.ts`,
`mediaCrypto.test.ts`, `backupCrypto.test.ts`. The evidence behind the strongest security
claims in the thesis is not exercised by any automated gate. Adding a fifth CI job
(`npm ci && npx tsc --noEmit && npm test`) is perhaps fifteen lines of YAML and should be
done before submission.

**Existing coverage data was stale** — dated 10 June 2026.

### ✅ V13 — Fixed, and measured

`npm install` from the **repository root** (not from `aza/`) restores the hoisted preset.
The suite then runs clean:

> **254 tests across 17 suites. 0 failures.** Runtime ≈ 28 s cold, ≈ 6 s warm.

Coverage, with `src/crypto` reported separately — which is the whole point, because the
aggregate is dragged down by 170 screens that no unit test touches:

| Scope | Statements | Branches | Functions |
|---|---|---|---|
| All instrumented files | 47.85% | 27.81% | 21.65% |
| **`src/crypto` (6 files)** | **87.76%** | **72.09%** | **89.19%** |

**State one caveat honestly when you quote the aggregate.** Jest instruments only files a
test actually imports — 25 of 387. The 47.85% is therefore coverage *of the tested subset*,
not of the codebase. Either add `collectCoverageFrom` to get a true denominator, or report
the crypto figure and describe the rest qualitatively. Do not present 47.85% as
whole-codebase coverage; it is not, and the difference is large.

**And a new CI job now gates it** (§16.3 V15).

### V15 · Mobile typecheck ✅ — 893 errors → 0, with two live bugs fixed

Full analysis as **Finding F4** in §16.2. Remedies:

| Change | Effect |
|---|---|
| `"types": ["jest"]` in `tsconfig.json` | −832 errors |
| `Buffer.from(x).toString('hex')` → local `hex()` helper in the two crypto tests | −20 |
| `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` (9 files) | −12 |
| **`StyleSheet.absoluteFillObject` → `absoluteFill` (18 sites, 14 files)** | −18, **fixes 18 broken overlays** |
| **`Clipboard.setString` → `setStringAsync`** | −1, **fixes a crashing Copy button** |
| Widened three optional props at the declaration side | −3 |
| `tsconfig.ci.json` + `types/miniapp-workspaces.d.ts` | −27 (contained) |

The last one needs its own justification, because a stub can look like sweeping something
under the rug. The mini apps in `project404/miniapps/*` are sibling npm workspaces with no
`node_modules` of their own; module resolution from `miniapps/<app>/index.tsx` walks up to
the repo root and finds nothing, because npm keeps `react` and `react-native` nested in
`aza/node_modules`. The errors are therefore about **workspace layout, not about the code**.
`tsconfig.ci.json` repoints the `@miniapps/*` aliases at a stub that *imports the app's own
`MiniAppProps`* — so the registry's assignment is still typechecked against the real
contract, and only the mini apps' internals are excluded. The stub records that the proper
fix is a shared tsconfig and hoisted dependencies for the workspaces.

Two things were attempted and rejected along the way, both worth a sentence in the thesis:

- **Dropping `baseUrl`** (it is deprecated in TS 6, removed in TS 7). It cannot be dropped:
  `baseUrl` is what points module resolution at `aza/node_modules` for the mini-app sources
  reached through `paths`. Removing it turned 1 deprecation warning into 27 hard errors.
  `"ignoreDeprecations": "6.0"` with a comment is the honest interim.
- **Mapping `react` through `paths`.** This resolved to `react/index.js` rather than
  `@types/react`, so every React import in the app became implicitly `any` — 174 KB of new
  errors. A reminder that `paths` is program-global and a poor tool for per-directory
  resolution.

### V16–V18 · New gates added

| Gate | Implementation | Status |
|---|---|---|
| Migrations verified against real PostgreSQL | `MigrationChainIT` (4 tests) | ✅ runs in CI |
| Concurrent-debit correctness measured | `ConcurrentTransferIT` (3 tests) | ✅ runs in CI |
| Backend coverage instrumented | JaCoCo in `pom.xml`, report uploaded by CI | ✅ |

Backend coverage, first measurement:

| Scope | Lines | Branches |
|---|---|---|
| Whole backend | 22.61% | 17.36% |
| **Money classes** (13, listed below) | **63.31%** | **46.40%** |

Per class, line coverage:

| Class | Lines | Class | Lines |
|---|---|---|---|
| `AfterCommitExecutor` | 100% | `AgentCashService` | 81% |
| `HoldLedgerAuditService` | 100% | `HoldService` | 80% |
| `UserWithdrawalService` | 100% | `FeeCalculationService` | 63% |
| `WalletLocker` | 100% | `ConnectService` | 61% |
| `LimitGuard` | 94% | `TransferService` | 52% |
| `ExpenseSplitService` | 93% | `CheckoutService` | 35% |
| `FloatService` | 91% | | |

**Report both numbers and explain the gap** — the analysis is the point, not the raw
figure. 22.61% overall reflects 100 services covering everything from birthday greetings to
Unsplash image search; 63.31% on the money path reflects where the testing effort was
deliberately spent. The two lowest, `TransferService` (52%) and `CheckoutService` (35%),
are also the two largest files in the set — 810 and 673 lines — so they are the honest
targets for the next round of tests.

> **A naming trap worth recording.** `WalletService` was initially counted as a money class
> and reported 3% coverage, which looked alarming. It is not a money class: its single
> public method is `getAppleWalletPassUrl`, a PassKit integration for adding a card to
> Apple Wallet. The money-wallet logic lives in `TransferService` and `WalletRepository`.
> Excluding it moved the money-path figure from 62.47% to 63.31%.
>
> Mention this in the thesis. It is a small, concrete illustration of a real methodological
> point: a coverage figure is only as meaningful as the set of classes you choose to
> measure, and that set has to be chosen by reading the code, not by matching names.

### V14 · Scheduler safety ❌ — confirmed single-instance

```bash
grep -rn "ShedLock\|SchedulerLock\|leader" scheduler/ config/   # → no matches
```

No distributed lock and no leader election. All nine `@Scheduled` jobs would run on every
instance simultaneously. Combined with `WEBSOCKET_LOCAL_DELIVERY=true`, the system is
**correct only on a single backend instance** — a genuine, bounded, well-understood
constraint that should be stated in the architecture chapter rather than discovered by a
marker.

---

---

## 16.4 Where the remediation landed

All of it is committed on branch `Home`, in reviewable slices rather than one bulk
commit. Cite these in the thesis when you describe a fix — a commit hash is stronger
evidence than a description of one.

| Commit | Subject | Covers |
|---|---|---|
| `d290807` | `chore: stop tracking aza/coverage, and version the thesis docs` | Build artefact untracked; scoped `.gitignore` negation so `docs/thesis/` is versioned |
| `468662e` | `fix: order wallet locks canonically and defer notifications past commit` | **F1 + F2**, plus 12 new tests |
| `664f65a` | `test: run the migration chain and a real concurrency experiment on Postgres` | `MigrationChainIT`, `ConcurrentTransferIT`, the `integration` profile |
| `7580280` | `build: add JaCoCo and run *IT classes under surefire` | Coverage instrumentation; Testcontainers BOM |
| `4da0656` | `fix: repair two shipping bugs the mobile typecheck was hiding` | **F4** — 893 → 0 errors, `absoluteFill`, `Clipboard.setStringAsync` |
| `d93fbeb` | `ci: run the mobile app's typecheck and tests` | **F5** — the `mobile-test` job; JaCoCo + coverage artifacts |
| `008055d` | `docs: add the thesis documentation set` | These seventeen files |

Verified at `008055d`: backend **374 tests, 0 failures, 0 errors** (7 Docker-gated
integration tests skip locally); mobile **254 tests, 0 failures**; mobile typecheck
**0 errors**; working tree clean.

### Two incidents during the commit, worth recording

Neither changes any result, but both are the kind of thing a methods chapter should be
honest about, and the second nearly destroyed a day's writing.

**1. `docs/` was gitignored by a bare pattern.** The root `.gitignore` carries a bare
`docs` entry, commented as deliberately matching any directory of that name at any
depth — the repository's convention is that `docs/` means scratch. Nothing under
`docs/` had ever been tracked, so the entire documentation set would have been silently
skipped by `git add`. The repo already had the pattern for the exception
(`!miniapps/aza-sdk/docs/`, justified in a comment as "product, not scratch"), so the
same treatment was applied. Getting it right needs three lines in order, because Git
will not descend into an excluded directory:

```gitignore
!/docs/          # re-include the root docs dir so Git descends into it
/docs/*          # …but re-exclude everything directly inside
!/docs/thesis/   # …then let just this back in
```

The leading slashes matter. A first attempt used bare `!docs/`, which un-ignored
`backend/docs` and the whole of `docs/` as well — verified and corrected before
committing. **Check what an ignore rule actually matches rather than what it looks like
it matches**; `git check-ignore -v <path>` names the exact rule and line.

**2. Seven chapter files were found merged on disk.** Between writing and staging,
`01`–`03`, `04`–`06`, `07`–`09` and `11`–`12` had been concatenated into four files with
comma-joined names (`01-introduction, background, methodology.md` and so on), and
`.gitignore` had separately lost a leading `!` after being written correctly. Cause not
established — no editor or hook in this repository does that, and it was not a Git
operation.

Recovery was clean because every chapter opens with a unique `# N. Title` heading, so the
merged files split back at exact boundaries with no content loss: 3,978 lines before,
3,978 after, all 17 files restored with their original line counts. The integrity check
was the useful part — comparing per-file line counts against the pre-merge measurements,
rather than assuming the split had worked.

**The lesson for the thesis, and it is a real one:** structure that is machine-checkable
is also machine-recoverable. Had the chapters not each begun with a distinct, parseable
heading, the merge would have been unrecoverable without rewriting from memory. The same
argument runs through Chapter 3 — an invariant you can check mechanically is worth more
than one you merely hold in your head.

## 16.5 Re-running this log

```bash
cd /Users/caleb/Desktop/GitHub/az-spaces/project404

# V1  idempotency ownership guard
grep -n "Ownership guard" backend/src/main/java/com/aza/backend/service/AgentCashService.java

# V2  lock ordering
grep -n "compareTo" backend/src/main/java/com/aza/backend/service/AgentCashService.java
grep -n "findByUserIdForUpdate" backend/src/main/java/com/aza/backend/service/TransferService.java

# V3  passcode throttle
grep -n "pin:attempts" -A 12 backend/src/main/java/com/aza/backend/service/UserService.java

# V4  certificate pinning
sed -n '1,60p' aza/plugins/withSslPinning.js

# V5  webhook signing, retry, SSRF guard
grep -n "RETRY_DELAYS_SECONDS\|X-Aza-Signature\|validateWebhookUrl" \
  backend/src/main/java/com/aza/backend/service/WebhookService.java

# V6  BigDecimal only
grep -rnE "private (double|float|Double|Float) " backend/src/main/java/com/aza/backend/entity/

# V7  GHS-only
grep -rniE "exchangeRate|currencyConver|fxRate|convertCurrency" backend/src/main/java

# V8  after-commit handling
grep -rn "TransactionalEventListener\|AFTER_COMMIT\|registerSynchronization" backend/src/main/java

# V9  super-agent float
find backend/src -name "SuperAgent*"; grep -rn "Tier.SUPER" backend/src/main/java

# V10 maker-checker
grep -n "SELF_APPROVAL" backend/src/main/java/com/aza/backend/service/ApprovalService.java

# V11 committed secrets
git log --all --full-history --oneline -- '**/.env' '.env'

# V12 backend suite
cd backend && mvn -q test -Dsurefire.excludes="**/*ApplicationTests.java"; cd ..

# V13 mobile suite + CI coverage
cd aza && npm test -- --coverage; cd ..
grep -n "app:" .github/workflows/ci.yml

# V14 scheduler locking
grep -rn "ShedLock\|SchedulerLock" backend/src/main/java

# ── Added for the second pass (§16.6) ───────────────────────────────────────

# V19 every wallet writer takes a lock
grep -rn "setBalance" backend/src/main/java | grep -v WalletLedger.java
# expect: no direct writers outside WalletLedger

# V20 idempotency on every money endpoint
grep -rn "idempotency_key\|idempotencyKey" backend/src/main/resources/db/migration \
  backend/src/main/java/com/aza/backend/service

# V21 chat content readability (expect the server-side cipher, no send-side E2EE)
grep -rn "encryptForAllDevices" aza/src            # expect: no matches
grep -n "contentCipher" backend/src/main/java/com/aza/backend/service/ChatService.java

# V22 deploy asserts container health
grep -n "RestartCount\|State.Health" .github/workflows/deploy.yml

# V23 TURN relay is defined and its config is documented
grep -n "coturn" docker-compose.yml; ls turnserver.conf.example

# counts quoted throughout the thesis
ls backend/src/main/resources/db/migration/*.sql | wc -l
for d in controller service repository entity dto; do \
  echo "$d $(find backend/src/main/java/com/aza/backend/$d -name '*.java' | wc -l)"; done
find aza/src -name '*Screen.tsx' | wc -l
```

---

## 16.6 Second verification pass — 2026-09-06, commit `9678fa5a`

Sixteen days, 48 commits, 344 files. The whole log was re-run rather than spot-checked,
because the point of a mechanical gate is that it is cheap to repeat.

### Measured results

```bash
cd backend && ./mvnw -B test
# Tests run: 509, Failures: 0, Errors: 0, Skipped: 7   → BUILD SUCCESS

cd aza && npx jest
# Test Suites: 24 passed, 24 total
# Tests:       326 passed, 326 total

cd aza && npx tsc -p tsconfig.json --noEmit
# exit 0, no output

# money-class coverage, from backend/target/site/jacoco/jacoco.csv
awk -F, 'NR>1' jacoco.csv | grep -E ",(AfterCommitExecutor|HoldLedgerAuditService|…)," \
  | awk -F, '{lm+=$8;lc+=$9} END{printf "%.2f%%\n", lc*100/(lc+lm)}'
```

| Metric | 2026-08-21 | 2026-09-06 |
|---|---|---|
| Backend tests / classes | 374 / 40 | **509 / 53** |
| Mobile tests / suites | 254 / 17 | **326 / 24** |
| Mobile typecheck errors | 0 | **0** |
| Whole-backend line coverage | 22.61% | **25.64%** |
| Money-class coverage, original 13 | 63.31% | **63.15%** |
| Money-class coverage, current 17 | — | **61.70%** |
| `src/crypto` statement coverage | 87.76% | **87.75%** |
| Flyway migrations | 57 | **62** (→ V64) |
| Backend controllers / services / entities | 113 / 100 / 105 | **120 / 116 / 111** |
| Invariants holding unconditionally | 8 of 9 | **9 of 9** |

The skipped 7 are the Docker-gated Testcontainers ITs, as before; they run in CI, and
**skipped is not passed** — cite the CI run when reporting them.

### New findings

#### F6 — Three wallet writers took no row lock

Invariant 4 was recorded as ✅ in the first pass, and the paths that pass traced did all
lock. Re-reading the invariant as a **search over every writer** rather than over every
documented flow found three that did not: the promo credit, the referral reward, and float
mint/burn. Twenty files each carried their own
`wallet.setBalance(...); walletRepository.save(wallet)` block; three omitted the lock.

*Failure scenario:* two concurrent requests read the same balance, both compute from it, one
write is lost. Money created or destroyed depending on sign.

**Closed structurally**, not locally: `WalletLedger` is now the only way to move a balance
and takes the lock at its entry point (§5.4a). `WalletLedgerTest` (14 tests, 97% lines),
`ApprovalLockingTest`, `TransactionReversalTest`.

**This is the most methodologically important finding in either pass.** It bounds what the
first pass could claim: a trace-based verification is only as complete as the set of flows
you know to trace, and "verified ✅" against that method means "no counter-example on the
paths examined", not "no counter-example". Say so in the thesis — it is a stronger position
than pretending the first verdict was wrong, because it was not wrong, it was *scoped*.

#### F7 — Three money endpoints had no idempotency key

Float mint (`V60`), user withdrawal (`V61`), recurring transfers. Detail in §5.4a. The float
case is the interesting one: **maker–checker does not cover it**, because two approvals for
the same bank deposit are two legitimate approvals — each passes every check the approver
can see. Dual control answers "did one person act alone?", not "has this event already been
processed?".

#### F8 — A verified security property was withdrawn

**V21 was ✅ at audit and is ❌ now, by design.** Chat message bodies are no longer
end-to-end encrypted; they are stored server-readable, encrypted at rest under a
server-held key, so history can follow the account rather than the device. Mechanism in
§6.3.0, reasoning and cost in §12.4a.

Recorded here as a finding, in the same format as the defects, because a verification log
that silently drops a claim it previously verified is worthless. The verdict changed; the
reason it changed is documented; the residual property (encryption at rest, T4a) is stated
separately from the one that was lost (T4b).

Corroborating check, and a strange one to write:

```bash
grep -rn "encryptForAllDevices" aza/src        # → no matches (removed, 68894e13)
grep -n "contentCipher" backend/src/main/java/com/aza/backend/service/ChatService.java
# → 171: messageBuilder.content(contentCipher.encrypt(request.getContent()));
# → 865: ... contentCipher.decrypt(message.getContent())
```

`ChatServiceMessageBodyTest` asserts that *a device holding no key material can read a
history page* — a test whose **passing** is the evidence for this finding.

#### F9 — The deploy gate printed its evidence and never read it

`docker compose ps` exits 0 whether a container is up, dead, or restarting in a loop. A
service that died on a bad config deployed "successfully". coturn restarted **201 times**
before the replacement gate caught it. Detail in §10.2.

Worth its own line because the failure is a *category* the thesis should name: a step that
produces the artefact a reader would accept as evidence, without performing the check that
artefact implies. It is worse than a missing check, because it defeats review.

#### F10 — TURN credentials were signed against a relay that did not exist

`turnserver.conf` was in the tree, `CallService` had always handed clients
`turn:<host>:3478` signed with `TURN_SECRET`, and **no service ever ran coturn**. Calls
connected only when peers reached each other directly — fine on shared Wi-Fi, broken behind
the symmetric NAT most mobile carriers use. Detail in §4.5.

Nothing was wrong in code, so no code-level check could have found it. The missing artefact
was a service definition.

### Findings re-checked and still open

| # | Item | Status |
|---|---|---|
| V14 | Scheduler locking | ❌ Unchanged — no ShedLock, no leader election, nine jobs |
| — | Password SSH in the deploy | ⚠️ Unchanged |
| — | Build-on-server rather than GHCR | ⚠️ Unchanged |
| — | Maestro flows not in CI | ⚠️ Unchanged |
| — | No dependency/SAST/secret scanning in CI | ⚠️ Unchanged |
| — | Web apps have no unit tests | ⚠️ Unchanged |
| — | `aza/coverage/` still tracked in git | ⚠️ Unchanged |

### What the second pass says about the method

Three observations the thesis can defend, and the third is the one worth arguing:

1. **The rate of finding declined but did not stop.** Pass 1 found five, pass 2 found five.
   The composition changed: pass 1 found things the invariants pointed straight at, pass 2
   found things only a *re-reading* of the invariants as queries pointed at — plus two
   (F9, F10) that no invariant covers because they are about deployment artefacts rather
   than code.
2. **Fixing structurally beats fixing locally, measurably.** F1 was fixed by adding
   `WalletLocker` and using it in the paths that were wrong; sixteen days later F6 found
   three more paths that had never used it. `WalletLedger` removes the possibility rather
   than the instances. The general rule: **if the fix is "and remember to do X", it is not a
   fix.**
3. **A verification log must be able to record regressions, including deliberate ones.**
   F8 is the test of that. It would have been easy to quietly rewrite Chapter 6 and leave
   the log showing V21 ✅ — nothing in the repository would contradict it, because the E2EE
   code is all still there and all still passing. The log's value is exactly its
   willingness to say the verdict changed.

---
