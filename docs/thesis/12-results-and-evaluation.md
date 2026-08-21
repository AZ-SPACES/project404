# 12. Results and Evaluation

Traceability, invariant conformance, the security matrix and **correctness under
concurrency (§12.5)** are complete and verified against the codebase on 2026-08-21 — method
and commands in `16-verification-log.md`. Three sections remain for you to run: performance
(§12.5b), competitive comparison (§12.6) and usability (§12.7). Those carry **[FILL IN]**
because they need measurement or external checking, not because the evidence was
unavailable.

## 12.1 Requirements traceability matrix

| # | Objective (§1.4) | Implementation evidence | Verification | Status |
|---|---|---|---|---|
| 1 | Multi-actor e-money domain and data model | `Wallet` (PERSONAL / AGENT_FLOAT), `Transaction` (8 types, 8 statuses), `Merchant`, `ConnectTransfer`, 57 Flyway migrations | Schema validated at boot (`ddl-auto=validate`); `SafeguardingHeldFloatTest` | **Met** |
| 2 | Transactional money engine with balanced movement, idempotency, concurrency safety, audit | `TransferService`, `WalletRepository.findByUserIdForUpdate` (PESSIMISTIC_WRITE), unique `idempotency_key`, per-merchant scoping (V43), ownership guard in `AgentCashService`, `AuditService`, `FloatService` mint/burn under dual control | `TransferServiceTest`, `CheckoutIdempotencyScopeTest`, `LimitGuardTest`, `DailySentTotalTest`, `HoldLedgerAuditServiceTest`, `SafeguardingHeldFloatTest` — all passing | **Met** with two documented qualifications (F1 lock ordering, F2 pre-commit effects); concurrency test outstanding |
| 3 | E2EE chat with forward secrecy, multi-device, opaque backups | `aza/src/crypto/` — X3DH v3, X25519/Ed25519/HKDF/AES-GCM, `(userId, deviceId)` keystore, per-device `MessageCiphertext` envelopes, per-file media keys, random-key backup, safety numbers | `x3dh.test.ts`, `e2ee.test.ts`, `keystore.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts` — **but not run by any CI job** | **Met** for user-to-user chat, minus post-compromise security (no Double Ratchet). Support chats are plaintext by design |
| 4 | Compliance and risk layer | 3-tier KYC + `LimitGuard`, `RiskEngineService` (large/velocity/structuring/anomaly), `ScreeningService`, `PendingApproval` maker–checker, `AdminStepUpFilter`, `RegulatoryService`, hash-chained `AuditAnchor` | `KycServiceTest`, `CashStructuringTest`, `LimitGuardTest` | **Met** |
| 5 | Third-party platform surface | Merchant API keys (live/test, scoped), hosted checkout, AZA Connect, OAuth 2.0 + PKCE + QR flow, payment mandates, Mini App SDK + runtime | `MerchantApiKeyFilterTest`, `ConnectServiceTest`, `MiniAppBundleServiceTest`, 7 reference mini apps | **Met** |
| 6 | Production-grade delivery engineering | GitHub Actions CI (3 jobs, 6 job instances), gated CD, Flyway with baselining, Docker Compose, nginx + automated TLS, 9 schedulers | CI green on `main`; live at `api.aza.systems`; no secret ever committed | **Met** for backend and web, with three verified gaps: no mobile CI job (§10.1), the GHCR/docker-rollout divergence (§10.2), single-instance-only schedulers (§10.6) |
| 7 | Evaluation | This chapter + `16-verification-log.md` (14 mechanical checks) | Invariant conformance ✅, security matrix ✅, backend suite ✅ 355/355. Performance, usability and comparative evaluation still to run | **Partially met** |

## 12.2 Functional completeness

| Domain | Delivered |
|---|---|
| Consumer app | 170 screens across 16 feature domains |
| Backend API | 113 controllers |
| Business logic | 100 services |
| Persistence | 105 entities, 109 repositories, 57 migrations |
| Admin operations | 40+ back-office areas |
| Merchant self-service | 29 portal areas |
| Developer platform | 4 integration surfaces, 3 published guides, 2 Postman collections, 1 npm SDK |
| Mini apps | 7 reference apps |

## 12.3 Invariant conformance

For each of the nine invariants (§5.4), state where it is enforced and what verifies it.
This table is the strongest correctness evidence in the thesis.

Verified 2026-08-21 against commit `8440c51`. Method and commands in
`16-verification-log.md`.

| # | Invariant | Enforcement point | Verified by | Result |
|---|---|---|---|---|
| 1 | Balanced movement | `TransferService` `@Transactional` methods; debit and credit in one boundary | `TransferServiceTest`, `HoldLedgerAuditServiceTest` (both pass) | ✅ **Holds** |
| 2 | Debit before external effect | `AfterCommitExecutor` defers every push/SMS/email/socket event to `afterCommit` | `AfterCommitExecutorTest` (5 tests), incl. `neverFires_whenTheTransactionRollsBack` | ✅ **Holds — F2 fixed.** Was partial at audit: effects fired pre-commit |
| 3 | Tenant-scoped idempotency | `UNIQUE(merchant_id, idempotency_key)` on Connect; V43 on checkout; ownership guard in `AgentCashService:56` | `CheckoutIdempotencyScopeTest` | ✅ **Holds** — the June 2026 `AgentCashService` finding is **closed** |
| 4 | Concurrency safety | `@Lock(PESSIMISTIC_WRITE)` finders; `WalletLocker` orders every pair canonically | **`ConcurrentTransferIT` — 100 parallel debits, measured**; `WalletLockerTest` (7 tests) | ✅ **Holds — measured, and F1 fixed.** Ordering was request-order at audit |
| 5 | `BigDecimal` only | `NUMERIC(15,2)` columns; `BigDecimal` fields | grep over entities → only `Double anomalyScore`, a risk score. **Also asserted at the schema level** by `MigrationChainIT.moneyColumnsAreExactDecimals` | ✅ **Holds — now enforced by a test** |
| 6 | AuthZ + passcode + maker–checker | `passcodeHash` (5 attempts/5 min), `ApprovalService` (18 gated actions, self-approval rejected incl. ADMIN), `@PreAuthorize`, `MerchantApiKeyFilter` | `LimitGuardTest`, `MerchantApiKeyFilterTest` | ✅ **Holds** |
| 7 | GHS-only scope | `currency` defaults `GHS`; no FX code path | `grep -rniE "exchangeRate\|currencyConver\|fxRate"` → none; no non-GHS currency literal | ✅ **Holds** |
| 8 | No margin on float distribution | — | `SuperAgentService` removed; `Agent.Tier.SUPER` unreferenced; `FloatService` has no fee logic | ⚠️ **Vacuous — F3.** Nothing to violate; retained as a forward constraint on the unbuilt super-agent portal |
| 9 | Audit trail | `AuditService` inside the transaction; daily SHA-256 `AuditAnchor` chain; `FloatMovement` on every mint/burn | `HoldLedgerAuditServiceTest`, `SafeguardingHeldFloatTest` | ✅ **Holds** |

**Summary: at audit, 6 of 9 held unconditionally, 2 held with a documented qualification,
and 1 was vacuous. After the fixes, 8 of 9 hold unconditionally and 1 remains vacuous.**

Report *both* states, and make the movement the point. A table of nine green ticks
demonstrates nothing about the method that produced it; a table showing two invariants that
did not hold, a diagnosis for each, a fix, and a test that now enforces it is the evidence
that the review gate in Chapter 3 does real work. The remaining vacuous invariant (8) is
left standing deliberately as a forward constraint — see §12.3b.

## 12.3b The one invariant left standing without code

Invariant 8 — *no margin on super-agent float distribution* — governs code that no longer
exists: `SuperAgentService` was removed, `Agent.Tier.SUPER` is declared but unreferenced,
and `FloatService` contains no fee or margin logic at all.

Resist the temptation to delete it and report nine-for-nine. The defensible position is that
a written invariant is a **constraint on future work**, not merely a description of present
code, and this one now applies to the unbuilt super-agent portal (`aza-superagents` is an
empty scaffold). Deleting it would mean the rule has to be rediscovered by whoever builds
that tier — which is precisely the failure mode Chapter 3 argues against.

State it plainly: 8 of 9 invariants hold and are enforced by tests; the ninth is retained
deliberately as a forward constraint and is marked as such.

## 12.4 Security evaluation

Map each threat from §6.1 to its control and to the evidence that the control works.

Verified 2026-08-21. Residual risks are stated deliberately — a threat table with no
residual column is not an evaluation.

| Threat | Control | Evidence | Residual risk |
|---|---|---|---|
| T1 stolen credentials | 5 second factors (TOTP with AES-256-GCM-encrypted secret, SMS, email, app-push, passkey), device recognition, behavioural detection, IP reputation | `AuthServiceTest`, `OtpServiceTest` (pass) | SMS 2FA remains SIM-swap vulnerable — state this explicitly; it is the weakest of the five and the most used in this market |
| T2 stolen device | App lock, 4-digit passcode per payment, biometrics, remote logout-everywhere, device blocking | `UserService:638`; Maestro `15_security_settings`, `17_setup_passcode` | **Verified: 5 attempts / 5-min Redis window, cleared on success.** 10⁴ space at 60 attempts/hour ⇒ ~83 h mean exhaustive search. No escalating backoff and no permanent lockout, so the attacker's rate never degrades |
| T3 network attacker | TLS 1.2/1.3, HSTS, **native root-CA certificate pinning on both platforms** | `aza/plugins/withSslPinning.js`; `node scripts/check-pins.js` | **Verified present.** Root-CA (not leaf) pinning trusts every cert Let's Encrypt or Google issues for the domain — deliberate, so routine rotation cannot brick the app. Android pin set expires 2027-08-01, after which it degrades to standard CA validation |
| T4 malicious server operator | E2EE for chat, media and backups; server holds ciphertext and public keys only | `x3dh.test.ts`, `e2ee.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts` — **now run in CI, and 87.76% statement coverage on `src/crypto`** | Metadata visible; **no post-compromise security** (no Double Ratchet); key-directory MITM mitigated only by user-performed safety-number comparison; **support chats are stored in plaintext by design** |
| T5 malicious insider | 18 maker–checker-gated actions with role-separated approvers, self-approval rejected incl. ADMIN, step-up 2FA, IP allowlist, daily hash-chained audit | `ApprovalService`; `AuditAnchorService` | Anchors live in the same database an attacker with write access controls — tampering is **detectable, not impossible**. Off-box anchoring is the fix |
| T6 malicious integrator | Scoped restricted keys, live/test key classes, tenant-scoped idempotency, ownership checks, HMAC-signed webhooks with SSRF guard | `MerchantApiKeyFilterTest`, `CheckoutIdempotencyScopeTest`, `ConnectServiceTest`; **`MigrationChainIT` now asserts the uniqueness constraints exist** | **`AgentCashService` idempotency finding is closed.** Webhook SSRF guard resolves the host once and the client resolves again — a DNS-rebinding gap remains |
| T7 malicious mini app | Permission manifest, per-user consent, pre-listing review, kill switch, **one browser origin per app**, uncompressed-size bound on extraction | `MiniAppBundleServiceTest`, `MiniAppCatalogSyncTest` (pass) | Review is manual and therefore fallible; a malicious update after approval is the realistic path |
| T8 fraud / AML | Tiered KYC limits via a single `LimitGuard`, velocity, structuring (≥3 in 24 h at 70–100% of threshold), anomaly scoring → `HELD_FOR_REVIEW`, sanctions screening | `CashStructuringTest`, `LimitGuardTest`, `DailySentTotalTest` (pass) | Rule-based only, no ML. Risk evaluation is wrapped in try/catch and never fails a transfer — so an evaluation bug leaves a transaction silently unscored (the `RiskDecisionLog` exists to detect this) |
| T9 automated abuse | Redis token buckets — 150/60 s per IP, 200/900 s per IP on auth paths, 300/60 s per fingerprint, 500/60 s per user; hCaptcha with HMAC-bound tokens; request fingerprinting | `RateLimitFilter`; limits tunable live via `AdminRateLimitController` | Limits are per-instance Redis counters, so correct today; demonstrate one firing for the thesis |

## 12.5 Correctness under concurrency — **measured**

The most important single experiment in the thesis, and the one that converts the
pessimistic-locking argument of §5.3 from a claim into a result.
`ConcurrentTransferIT`, real PostgreSQL 16 via Testcontainers, all tasks released
simultaneously by a `CountDownLatch` so the threads genuinely contend.

| Experiment | Expectation | Result |
|---|---|---|
| **Double-spend.** 100 parallel debits of GHS 1.00 from a wallet holding GHS 50.00 | exactly 50 succeed, 50 rejected, 0 errors, final balance GHS 0.00 | ✅ **exactly as predicted** |
| **Oversubscription.** 40 parallel debits of GHS 20.00 from GHS 50.00 | two succeed, balance lands on GHS 10.00, never negative | ✅ |
| **Bidirectional deadlock.** 60 alternating A→B / B→A transfers in parallel | zero SQLSTATE 40P01 aborts; the pair still holds GHS 100.00 between them | ✅ **0 deadlocks, value conserved** |

The third experiment is the regression test for Finding F1: before `WalletLocker`, A→B
locked A then B while B→A locked B then A, and PostgreSQL broke the cycle by aborting one.

**What this does and does not establish.** It establishes that the locking discipline is
correct under contention on PostgreSQL — no double-spend, no negative balance, no lost or
created value, no deadlock. It does **not** establish throughput or latency; the experiment
is about correctness, and the two questions should not be conflated in the write-up.

## 12.5b Performance evaluation — **[FILL IN: run these]**

Still outstanding, and now the largest remaining hole in this chapter. Suggested method:
k6 or JMeter against a local Compose stack with a seeded database, 3 runs per scenario,
report median and p95.

| Scenario | Metric | Target | Measured |
|---|---|---|---|
| `GET /api/v1/wallet/balance` | p50 / p95 latency | < 100 / 300 ms | |
| `POST /api/v1/transfers` | p50 / p95 latency | < 300 / 800 ms | |
| `POST /api/v1/transfers` | throughput at 50 concurrent users | | |
| Checkout session creation | p95 latency | | |
| WebSocket message delivery | end-to-end latency | < 500 ms | |
| E2EE encrypt/decrypt | per-message time on a mid-range Android device | | |
| X3DH handshake | first-message overhead vs cached-root-key send | | |
| Mobile cold start | time to interactive | < 3 s | |
| Mobile JS bundle size | MB | | |
| Backend memory / CPU | steady state and under load | | |

## 12.6 Comparative evaluation — **[FILL IN]**

A feature comparison against the market is quick to produce and reads well:

| Capability | AZA | MTN MoMo | Chipper Cash | Wave | Cash App |
|---|---|---|---|---|---|
| P2P transfer | ✔ | ✔ | ✔ | ✔ | ✔ |
| E2E-encrypted chat | ✔ | ✘ | ✘ | ✘ | ✘ |
| In-chat payments | ✔ | ✘ | ✘ | ✘ | ✘ |
| Bill splitting (weighted, netting, recurring) | ✔ | ✘ | ✘ | ✘ | partial |
| QR merchant acceptance | ✔ | ✔ | ✔ | ✔ | ✔ |
| Agent cash-in/out | ✔ | ✔ | ✘ | ✔ | ✘ |
| Hosted checkout API | ✔ | partial | ✘ | ✘ | ✘ |
| Marketplace splits | ✔ | ✘ | ✘ | ✘ | ✘ |
| OAuth "Sign in with" | ✔ | ✘ | ✘ | ✘ | ✘ |
| Payment mandates | ✔ | ✘ | ✘ | ✘ | ✘ |
| Mini-app platform | ✔ | ✘ | ✘ | ✘ | ✘ |
| Public statement/payment verification | ✔ | ✘ | ✘ | ✘ | ✘ |
| Voice/video calling | ✔ | ✘ | ✘ | ✘ | ✘ |

**Verify every ✘ before publishing this table** — competitors ship features continuously,
and a wrong cell is an easy thing for an examiner to catch. Cite the date you checked.

## 12.7 Usability evaluation — **[FILL IN]**

If you can run even a small study, do — it is disproportionately valuable:
- 5–10 participants from the target demographic (18–35, Ghana).
- Tasks: complete signup; send money to a contact; split a bill three ways; pay a merchant
  QR; verify a payment proof.
- Instruments: task completion rate, time on task, error count, and the **System Usability
  Scale (SUS)** — a 10-item questionnaire with a published benchmark (68 = average), which
  gives you a citable number rather than an impression.
- Report SUS mean and standard deviation, plus per-task completion.

If no study was run, say so plainly and justify the alternative (heuristic evaluation
against Nielsen's ten heuristics is a legitimate, citable fallback you can do alone).

## 12.8 Discussion

Points to argue in the discussion section:

1. **The monolith was the right choice.** The invariants in §5.4 — particularly balanced
   movement inside one transactional boundary — are enforceable precisely *because* wallet,
   transaction, hold and split writes share a database transaction. A microservice
   decomposition would have replaced a `@Transactional` method with a saga, and every
   invariant with an eventually-consistent approximation of one. Scale did not require it.
2. **Documented invariants outperform ad-hoc review at this scale, and there is now a
   measured chain of evidence for it.** The original audit finding — a withdrawal that never
   debited — motivated a written checklist. Running that checklist mechanically against the
   codebase found two invariants that did not hold (F1 lock ordering, F2 pre-commit effects)
   and one that had become vacuous (F3). Both live findings were fixed and are now enforced
   by tests. The strongest detail is that **the correct pattern for each fix already existed
   elsewhere in the same codebase** — `AgentCashService` ordered its locks correctly and
   `ChatService` deferred its effects correctly, while the money path did neither.

   That is the whole argument in one observation: an invariant that is *understood* by the
   authors is not the same as an invariant that is *enforced*. The gap between the two is
   exactly what a mechanical gate closes, and it is invisible without one.
3. **Adopting migrations over an inferred schema is a distinct, under-documented problem.**
   The `baseline-on-migrate` strategy plus the six fix commits in §10.3 are a case study
   worth generalising.
4. **E2EE and regulatory obligation are compatible, but only because they cover different
   objects.** AZA cannot read message content; it can and must read the ledger. Drawing the
   boundary at "content is encrypted, value movement is auditable" is what makes both
   properties simultaneously satisfiable — and it is a genuinely interesting result to
   state, because the naive assumption is that the two requirements conflict.
5. **A type system is a defect-detection instrument, not a style preference.** With no CI
   job running it, the mobile typecheck had drifted to 893 errors — and buried in the noise
   were two live defects shipping to users: eighteen overlays silently stripped of their
   positioning by a React Native API that no longer exists, and a Copy button that threw on
   every press. Neither is reachable by a unit test (nothing asserts on style objects), and
   Metro strips types without checking them, so the build stayed green throughout. This is a
   concrete, quantified answer to "was the missing CI job actually costing anything" — and a
   better argument for static analysis than any appeal to best practice.

6. **The platform surfaces are the strategic contribution.** A wallet is a product; a
   wallet with an OAuth identity, a checkout API, marketplace splits and a mini-app runtime
   is a platform. Discuss the network-effect argument and the corresponding increase in
   attack surface (T6, T7).
