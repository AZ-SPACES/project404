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
10. **Invariant 8 is currently vacuous** (Finding F3). `SuperAgentService` was removed and
    `Agent.Tier.SUPER` is unreferenced, so the no-margin rule for super-agent float
    distribution governs no live code. It is retained as a forward constraint on the
    unbuilt super-agent portal.

> **Resolved since the first draft:** the June 2026 `AgentCashService` idempotency finding
> is **closed** — an explicit ownership guard at `AgentCashService:56` rejects a replayed
> key belonging to a different principal.

### Security
11. **No post-compromise security in the E2EE protocol.** A Double Ratchet is designed for
    but not implemented; v3 is wire-compatible with adding one.
12. **Safety-number verification is optional and user-driven**, so the key-directory MITM
    is mitigated in principle but not in practice for most users.
13. **Audit anchors live in the same database they protect** — tampering is detectable, not
    prevented.
14. **Metadata is not protected** by E2EE: the social graph, timing and message sizes are
    visible to the operator.
15. **Support conversations are stored in plaintext** (`ChatMessage.content` when
    `chat.isSupport`), necessarily, so support agents can read them. The E2EE claim must be
    scoped to user-to-user chat.
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
| No mobile CI job | `mobile-test` runs typecheck + 254 tests + coverage |
| Mobile suite not runnable | Restored; documented root-install requirement |
| Mobile app did not typecheck (893 errors) | 0 errors; **two live runtime bugs fixed** |
| No integration tests against real PostgreSQL | `MigrationChainIT`, `ConcurrentTransferIT` |
| Double-spend defence never demonstrated | Measured: 100 parallel debits, exactly 50 succeed |
| Non-canonical lock ordering (F1) | `WalletLocker`, 7 unit tests + a bidirectional IT |
| Effects fired pre-commit (F2) | `AfterCommitExecutor`, 5 unit tests |
| No backend coverage instrumentation | JaCoCo; money classes 63.31% lines |

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
25. **Deploy builds on the server**, waits a fixed 15 seconds rather than polling
    healthchecks, and uses **password SSH**. The GHCR + docker-rollout target is documented
    but not implemented.
26. **Mini-app workspaces are excluded from the CI typecheck** behind a documented stub. The
    proper fix is a shared tsconfig and hoisted dependencies for those workspaces.
27. **`aza-superagents` is an empty scaffold** — the super-agent tier is designed (float
    model, no-margin invariant) but has neither a portal nor live service code.
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
6. **State the regulatory position** (§1.5) and the KYC-tier placeholder caveat explicitly.
7. **Verify the competitive comparison table** (§12.6) and cite the date checked.
8. **Document requirements elicitation** (§3.3), or justify the alternative.

Items 1–5 are engineering and can be finished in a day. Items 6–8 are yours to write and
cannot be delegated.

### Short term
5. **Double Ratchet** on top of the existing X3DH v3 — post-compromise security, the single
   largest security upgrade available.
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
12. **Super-agent portal** (`aza-superagents`) — master agents distributing float down a
    hierarchy, under the existing no-margin invariant.
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

> An integrated platform combining end-to-end encrypted messaging with regulated e-money
> settlement is not only feasible but architecturally coherent, because the two
> requirements govern different objects: message *content* can be made unreadable to the
> operator while value *movement* remains fully auditable. The engineering cost of that
> coherence is a small set of explicit, enforceable invariants — balanced movement,
> tenant-scoped idempotency, lock-based concurrency, dual control and an unbroken audit
> trail — and this work demonstrates that those invariants can be stated, mechanically
> reviewed, and maintained across a 220,000-line system and 57 schema migrations by a very
> small team.

Then state what remains unproven — and be specific, because a precise limitation reads as
confidence and a vague one reads as evasion:

- **Post-compromise security.** Not implemented; the protocol is designed to accept a Double
  Ratchet without breaking wire compatibility.
- **Horizontal scale.** The system is correct on one backend instance and not yet on two;
  both blockers (Redis fan-out, scheduler locking) are identified and bounded.
- **Performance under load.** Correctness under concurrency is now measured; throughput and
  latency are not.

Point at §13.2 for how each is closed. Note what *is* now proven, because the first draft of
this chapter could not say it: the double-spend defence is measured rather than argued, the
migration chain is verified against a real database, and the cryptographic suite is behind
an automated gate.
