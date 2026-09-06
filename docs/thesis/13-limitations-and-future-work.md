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
27b. **The watchOS companion has never been compiled.** Swift unit tests exist but the
    platform components are not installed in the development Xcode, so neither the tests nor
    the app have been built; only the TypeScript side is exercised by CI (§7.7).
27c. **No check that enum-backed `CHECK` constraints match their Java enums.** `V64` exists
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
5b. **Install the watchOS platform components** (`xcodebuild -downloadPlatform watchOS`) and
   build the watch target at least once. It currently blocks building the iOS scheme too,
   so this is not optional work — it is a prerequisite for any iOS release (§7.7).
5c. **Add a schema-drift check** comparing enum-backed `CHECK` constraints against the
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
