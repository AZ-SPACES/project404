# 12. Results and Evaluation

Traceability, invariant conformance, the security matrix and **correctness under
concurrency (§12.5)** are complete and verified against the codebase, first on 2026-08-21
and **re-verified on 2026-09-06 at commit `9678fa5a`** — method and commands in
`16-verification-log.md` (§16.5 covers the second pass). Three sections remain for you to
run: performance (§12.5b), competitive comparison (§12.6) and usability (§12.7). Those carry
**[FILL IN]** because they need measurement or external checking, not because the evidence
was unavailable.

**Two results changed materially between the two passes, and both should be reported as
movement rather than as final state.** Invariant 8 stopped being vacuous, because the
super-agent tier it governs was built (§12.3). And objective 3 was *narrowed*: chat is no
longer end-to-end encrypted for new messages. The second is a reduction in a security
property that the thesis claimed as its strongest, so it is stated first, in full, and
without softening — see §12.4a.

## 12.1 Requirements traceability matrix

| # | Objective (§1.4) | Implementation evidence | Verification | Status |
|---|---|---|---|---|
| 1 | Multi-actor e-money domain and data model | `Wallet` (PERSONAL / AGENT_FLOAT), `Transaction` (9 types, 8 statuses), `Merchant`, `ConnectTransfer`, agent hierarchy + `float_distributions` (V58), 62 Flyway migrations | Schema validated at boot (`ddl-auto=validate`); `SafeguardingHeldFloatTest`; `MigrationChainIT` replays V1–V64 against a real PostgreSQL | **Met** |
| 2 | Transactional money engine with balanced movement, idempotency, concurrency safety, audit | **`WalletLedger` — the single place a balance changes**, lock taken at the entry point (§5.4a); `WalletLocker` canonical ordering; unique `idempotency_key` incl. user withdrawals (V61) and float mint (V60); per-merchant scoping (V43); `AfterCommitExecutor`; `AuditService` | `WalletLedgerTest`, `TransferServiceTest`, `ApprovalLockingTest`, `TransactionReversalTest`, `RecurringTransferExecutorTest`, `ConcurrentTransferIT`, `CheckoutIdempotencyScopeTest`, `SafeguardingHeldFloatTest` — all passing | **Met.** F1 and F2 fixed; three unlocked wallet writers and three idempotency gaps found and closed after the audit |
| 3 | E2EE chat with forward secrecy, multi-device, opaque backups | `aza/src/crypto/` — X3DH v3, X25519/Ed25519/HKDF/AES-GCM, `(userId, deviceId)` keystore, per-device `MessageCiphertext` envelopes, per-file media keys, random-key backup, safety numbers. **Send path retired 2026-09-02**; decrypt path retained for all pre-existing history. New bodies: `MessageContentCipher`, AES-256-GCM at rest under a server-held key | `x3dh.test.ts`, `e2ee.test.ts`, `keystore.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts`, `MessageContentCipherTest`, `ChatServiceMessageBodyTest` — **all now run by the mobile CI job** | **Not met as originally stated — deliberately withdrawn.** Delivered and demonstrated as a protocol; retired as a live property in favour of account-owned cross-device history. See §12.4a |
| 4 | Compliance and risk layer | 3-tier KYC + `LimitGuard`, `RiskEngineService` (large/velocity/structuring/anomaly), `ScreeningService`, `PendingApproval` maker–checker, `AdminStepUpFilter`, `RegulatoryService`, hash-chained `AuditAnchor` | `KycServiceTest`, `CashStructuringTest`, `LimitGuardTest` | **Met** |
| 5 | Third-party platform surface | Merchant API keys (live/test, scoped), hosted checkout, AZA Connect, OAuth 2.0 + PKCE + QR flow, payment mandates, Mini App SDK + runtime | `MerchantApiKeyFilterTest`, `ConnectServiceTest`, `MiniAppBundleServiceTest`, 7 reference mini apps | **Met** |
| 6 | Production-grade delivery engineering | GitHub Actions CI (4 jobs, 8 job instances incl. the mobile job and a 5-app frontend matrix), gated CD with a **health-asserting deploy gate**, Flyway with baselining, Docker Compose, nginx + automated TLS, coturn, 9 schedulers | CI green on `main`; live at `api.aza.systems`; no secret ever committed | **Met.** F5 closed (mobile CI job); the deploy gate now fails on a container that is exited, unhealthy or crash-looping (§10). Single-instance-only schedulers remain a stated scaling limit |
| 7 | Evaluation | This chapter + `16-verification-log.md` (18 mechanical checks, plus the §16.5 re-verification) | Invariant conformance ✅ **9 of 9**, security matrix ✅, backend suite ✅ **509/509** (7 Docker-gated skips), mobile ✅ **326/326** with a clean typecheck. Performance, usability and comparative evaluation still to run | **Partially met** |

## 12.2 Functional completeness

| Domain | Delivered | Change since 2026-08-21 |
|---|---|---|
| Consumer app | 171 screens across 16 feature domains | +1 |
| watchOS companion | 1 read-only app + 3 WidgetKit complications | **new** |
| Backend API | 120 controllers | +7 |
| Business logic | 116 services | +16 |
| Persistence | 111 entities, 110 repositories, 62 migrations | +6 / +1 / +5 |
| Web surfaces | 5 Next.js apps | +1 (`aza-superagents`) |
| Admin operations | 40+ back-office areas | — |
| Merchant self-service | 29 portal areas | — |
| Agent network | 3 tiers (standard, super/master, staff-approved onboarding) with a float-distribution ledger | **new tier** |
| Developer platform | 4 integration surfaces, 3 published guides, 2 Postman collections, 1 npm SDK | — |
| Mini apps | 7 reference apps | — |

## 12.3 Invariant conformance

For each of the nine invariants (§5.4), state where it is enforced and what verifies it.
This table is the strongest correctness evidence in the thesis.

Verified 2026-08-21 against commit `8440c51`; **re-verified 2026-09-06 against `9678fa5a`**.
Method and commands in `16-verification-log.md`.

| # | Invariant | Enforcement point | Verified by | Result |
|---|---|---|---|---|
| 1 | Balanced movement | `TransferService` `@Transactional` methods; debit and credit in one boundary | `TransferServiceTest`, `HoldLedgerAuditServiceTest` (both pass) | ✅ **Holds** |
| 2 | Debit before external effect | `AfterCommitExecutor` defers every push/SMS/email/socket event to `afterCommit` | `AfterCommitExecutorTest` (5 tests), incl. `neverFires_whenTheTransactionRollsBack` | ✅ **Holds — F2 fixed.** Was partial at audit: effects fired pre-commit |
| 3 | Tenant-scoped idempotency | `UNIQUE(merchant_id, idempotency_key)` on Connect; V43 on checkout; ownership guard in `AgentCashService:56`; **V60** `UNIQUE(type, bank_reference)` on float movements; **V61** `UNIQUE(user_id, idempotency_key)` on withdrawals; required, master-scoped keys on float distribution | `CheckoutIdempotencyScopeTest`, `FloatServiceTest`, `UserWithdrawalServiceTest`, `SuperAgentServiceTest` | ✅ **Holds** — three further gaps found and closed after the audit (§5.4a) |
| 4 | Concurrency safety | **`WalletLedger` takes the lock at the entry point**, so no caller can omit it; `WalletLocker` orders every pair canonically; approvals and reversals lock too | **`ConcurrentTransferIT` — 100 parallel debits, measured**; `WalletLockerTest` (7), `WalletLedgerTest` (14), `ApprovalLockingTest`, `TransactionReversalTest` | ✅ **Holds — now structurally.** Three unlocked writers existed at audit and were not on any traced path (§5.4a) |
| 5 | `BigDecimal` only | `NUMERIC(15,2)` columns; `BigDecimal` fields | grep over entities → only `Double anomalyScore`, a risk score. **Also asserted at the schema level** by `MigrationChainIT.moneyColumnsAreExactDecimals` | ✅ **Holds — now enforced by a test** |
| 6 | AuthZ + passcode + maker–checker | `passcodeHash` (5 attempts/5 min), `ApprovalService` (18 gated actions, self-approval rejected incl. ADMIN), `@PreAuthorize`, `MerchantApiKeyFilter` | `LimitGuardTest`, `MerchantApiKeyFilterTest` | ✅ **Holds** |
| 7 | GHS-only scope | `currency` defaults `GHS`; no FX code path | `grep -rniE "exchangeRate\|currencyConver\|fxRate"` → none; no non-GHS currency literal | ✅ **Holds** |
| 8 | No margin on float distribution | `SuperAgentService`: `AGENT_FLOAT`→`AGENT_FLOAT` move, no fee, no spread, no commission accrual on either side; `float_distributions` ledger (V58) | `SuperAgentServiceTest` (17 tests) | ✅ **Holds — F3 closed.** Was vacuous at audit: the tier it governs did not exist |
| 9 | Audit trail | `AuditService` inside the transaction; daily SHA-256 `AuditAnchor` chain; `FloatMovement` on every mint/burn; `float_distributions` on every master↔sub movement | `HoldLedgerAuditServiceTest`, `SafeguardingHeldFloatTest`, `SuperAgentServiceTest` | ✅ **Holds** |

**Summary of the three states, which is the actual result:**

| | 2026-08-21 (audit) | After the audit remediation | 2026-09-06 |
|---|---|---|---|
| Hold unconditionally | 6 | 8 | **9** |
| Hold with a documented qualification | 2 | 0 | 0 |
| Vacuous | 1 | 1 | 0 |

Report all three states, and make the movement the point. A table of nine green ticks
demonstrates nothing about the method that produced it; a table showing two invariants that
did not hold, a diagnosis for each, a fix, and a test that now enforces it is the evidence
that the review gate in Chapter 3 does real work.

**The nine-for-nine column carries one extra claim that is easy to miss and is the most
useful finding in this table.** The invariants did not converge because the remaining work
happened to satisfy them. They converged because each rule was used as a *search query*
against code the audit had never traced — and invariant 4, which was verified as holding in
August, turned out to be held only by convention: three wallet writers took no row lock, on
paths (promo credit, referral reward, float mint/burn) that no documented money flow passed
through. An invariant that is enforced by every author remembering it is not a verified
property, it is an unfalsified one. §5.4a is the structural fix; §12.8 draws the general
conclusion.

## 12.3b The invariant that was left standing without code — and what that bought

Invariant 8 — *no margin on super-agent float distribution* — governed code that did not
exist at audit: `SuperAgentService` had been removed, `Agent.Tier.SUPER` was declared but
unreferenced, and `FloatService` contained no fee or margin logic at all. The August
position was to keep it rather than delete it and report nine-for-nine, on the argument that
a written invariant is a **constraint on future work**, not merely a description of present
code.

**That position was vindicated, and the mechanism is worth reporting precisely.** When the
super-agent tier was built (`d35b9b59`), the invariant was already written, already
attributed to a tier, and already specific about what "no margin" means — no fee, no spread,
and no commission accrual on *either* side. It did not have to be rediscovered, argued for,
or reverse-engineered from a product conversation; it went into `V58`'s header comment and
into the service, and `SuperAgentServiceTest` now enforces it. The rule preceded the code it
governs by roughly two weeks.

There is a stronger claim available here, and the thesis should make it carefully rather than
overclaim. The vacuous invariant did not merely survive until its code arrived — **it is
what located the gap in the first place.** An invariant with nothing to govern is an
anomaly, and asking why produced the answer "because a tier the product design assumes was
removed and never rebuilt". A feature backlog would not have surfaced that; a list of rules
with one rule pointing at nothing did.

The generalisable form: **invariants written ahead of implementation are cheap, and their
failure mode is benign.** A vacuous invariant costs one honest row in a table. A missing one
costs whatever the first person to build that path decides on their own.

## 12.4 Security evaluation

Map each threat from §6.1 to its control and to the evidence that the control works.

Verified 2026-08-21, re-verified 2026-09-06. Residual risks are stated deliberately — a
threat table with no residual column is not an evaluation.

| Threat | Control | Evidence | Residual risk |
|---|---|---|---|
| T1 stolen credentials | 5 second factors (TOTP with AES-256-GCM-encrypted secret, SMS, email, app-push, passkey), device recognition, behavioural detection, IP reputation | `AuthServiceTest`, `OtpServiceTest` (pass) | SMS 2FA remains SIM-swap vulnerable — state this explicitly; it is the weakest of the five and the most used in this market |
| T2 stolen device | App lock, 4-digit passcode per payment, biometrics, remote logout-everywhere, device blocking | `UserService:638`; Maestro `15_security_settings`, `17_setup_passcode` | **Verified: 5 attempts / 5-min Redis window, cleared on success.** 10⁴ space at 60 attempts/hour ⇒ ~83 h mean exhaustive search. No escalating backoff and no permanent lockout, so the attacker's rate never degrades |
| T3 network attacker | TLS 1.2/1.3, HSTS, **native root-CA certificate pinning on both platforms** | `aza/plugins/withSslPinning.js`; `node scripts/check-pins.js` | **Verified present.** Root-CA (not leaf) pinning trusts every cert Let's Encrypt or Google issues for the domain — deliberate, so routine rotation cannot brick the app. Android pin set expires 2027-08-01, after which it degrades to standard CA validation |
| T4a stolen database dump | Chat bodies and media keys AES-256-GCM at rest (`CHAT_CONTENT_KEY`), TOTP secrets AES-256-GCM (`TOTP_ENCRYPTION_KEY`), BCrypt password and passcode hashes; key material in configuration, not in the table | `MessageContentCipherTest` (8), `ChatServiceMessageBodyTest` (a body is persisted encrypted and returned readable; a device with no key material can read a history page) | A dump taken **together with** the deployment config yields everything. The two must be separated operationally, which is a process control, not a technical one |
| T4b malicious server operator | For pre-2026-09-02 history: E2EE, server holds ciphertext and public keys only. For everything since: **no defence, by design** (§6.3.0). Encrypted backups keep a user-held recovery key | `x3dh.test.ts`, `e2ee.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts` — **now run in CI, 87.75% statement coverage on `src/crypto`** | **The platform can read current user-to-user chat.** Also: metadata visible; no post-compromise security (no Double Ratchet) even for legacy history; key-directory MITM mitigated only by user-performed safety-number comparison |
| T5 malicious insider | 18 maker–checker-gated actions with role-separated approvers, self-approval rejected incl. ADMIN, step-up 2FA, IP allowlist, daily hash-chained audit | `ApprovalService`; `AuditAnchorService` | Anchors live in the same database an attacker with write access controls — tampering is **detectable, not impossible**. Off-box anchoring is the fix |
| T6 malicious integrator | Scoped restricted keys, live/test key classes, tenant-scoped idempotency, ownership checks, HMAC-signed webhooks with SSRF guard | `MerchantApiKeyFilterTest`, `CheckoutIdempotencyScopeTest`, `ConnectServiceTest`; **`MigrationChainIT` now asserts the uniqueness constraints exist** | **`AgentCashService` idempotency finding is closed.** Webhook SSRF guard resolves the host once and the client resolves again — a DNS-rebinding gap remains |
| T7 malicious mini app | Permission manifest, per-user consent, pre-listing review, kill switch, **one browser origin per app**, uncompressed-size bound on extraction | `MiniAppBundleServiceTest`, `MiniAppCatalogSyncTest` (pass) | Review is manual and therefore fallible; a malicious update after approval is the realistic path |
| T8 fraud / AML | Tiered KYC limits via a single `LimitGuard`, velocity, structuring (≥3 in 24 h at 70–100% of threshold), anomaly scoring → `HELD_FOR_REVIEW`, sanctions screening | `CashStructuringTest`, `LimitGuardTest`, `DailySentTotalTest` (pass) | Rule-based only, no ML. Risk evaluation is wrapped in try/catch and never fails a transfer — so an evaluation bug leaves a transaction silently unscored (the `RiskDecisionLog` exists to detect this) |
| T9 automated abuse | Redis token buckets — 150/60 s per IP, 200/900 s per IP on auth paths, 300/60 s per fingerprint, 500/60 s per user; **unauthenticated rules key on device before IP** (§6.4); hCaptcha with HMAC-bound tokens; request fingerprinting | `RateLimitFilter`, `RateLimitFilterActorKeyTest` (new); limits tunable live via `AdminRateLimitController` | A device identifier is client-supplied and rotatable, so the per-device bucket is weaker evidence than the per-IP one it replaced — accepted deliberately, because under Ghanaian CGNAT the IP bucket pooled unrelated subscribers and auto-blocked whole carriers. Fingerprinting, hCaptcha and behavioural detection key independently |

## 12.4a The withdrawn security property — report this, do not bury it

Objective 3 (§1.4) promised end-to-end encrypted chat, and Chapter 6 called it *"the
strongest claim the system makes"*. **On 2026-09-02 that claim was withdrawn for new
messages.** A thesis that quietly downgrades its strongest claim between chapters is worse
than one that never made it, so this section states the result, the reason and the cost in
one place, and §6.3.0 carries the technical detail.

**What was delivered.** The protocol was built, and built properly: X3DH over
X25519/Ed25519 with HKDF-SHA256 and AES-256-GCM, per-`(userId, deviceId)` identities in
hardware-backed storage, one-time pre-keys consumed and deleted at decrypt time, three
coexisting protocol versions for migration, canonical-JSON AAD after a delimiter-collision
lesson at v1, and safety numbers for the key-directory MITM. It has 87.75% statement
coverage and runs in CI. **The engineering objective was met.** It shipped and it worked.

**Why it was withdrawn.** Under per-device E2EE, chat history belongs to a *device*, not to
an *account*. A device that logs in fresh — a replacement phone, a second phone, a
reinstall — holds no key material, so no envelope on the server can be opened by it. The
two mitigations built for this (`ChatBackup`, `HistoryTransfer`) both require the *old*
device to be present and cooperative, which is precisely what a lost or broken phone is
not. In the target market, where a phone is frequently the user's only device and
replacement is common, "your messages are gone" is not an edge case.

**What replaced it.** The Telegram cloud-chat / Instagram DM model: bodies are readable by
the server, so it can serve history to any device that authenticates as the account, and
are encrypted at rest under `CHAT_CONTENT_KEY` so a stolen dump is still ciphertext.

**The cost, stated without softening.** T4b in the table above is no longer defended for
current traffic. AZA can read its users' messages. No amount of at-rest encryption changes
that, because AZA holds the key.

**Why this is a better result for the thesis than the original claim would have been**, and
this is the argument to make in the viva rather than an apology:

1. It is a *measured* engineering trade with both sides quantified, not a capability that
   was never attempted. Per-device fan-out costs O(devices) storage and bandwidth plus two
   synchronous key-bundle fetches per cold send — and after paying all of it, still cannot
   serve device *n+1* (§6.3 quantifies this).
2. It is the trade the large deployed messengers make, and for the same reason. Signal
   holds the line on E2EE and pays for it with exactly this: history that does not follow
   the account. WhatsApp pays for it with an encrypted-backup flow whose recovery key users
   lose. The literature on secure-messaging usability predicts this outcome; the project
   reproduced it independently and can cite it.
3. The honest reporting of a withdrawn property is itself a result. The alternative —
   leaving Chapter 6's E2EE claim intact because the code is still in the repository — would
   have been false in a way no examiner could check without reading the send path.

**What remains, and it is not nothing:** encryption at rest for bodies and media keys, TLS
with certificate pinning in transit, the media blob never decryptable by the media host, a
user-held recovery key for backups, and a complete E2EE implementation retained as the
decrypt path for existing history — and as the foundation a Double Ratchet would extend if
a future opt-in "secret chat" mode is added (§13).

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
4. **E2EE and regulatory obligation were compatible; E2EE and cross-device history were
   not.** The first half of this point survives and is worth keeping: AZA never needed to
   read message *content* to meet its obligations, because the obligations attach to the
   ledger, and drawing the boundary at "content is encrypted, value movement is auditable"
   made both properties simultaneously satisfiable. The naive assumption that regulation
   forces a backdoor into messaging is wrong, and this system demonstrates it.

   What actually broke E2EE was a **product** requirement, not a regulatory one, and the
   revised claim is more interesting than the original. Per-device encryption makes history
   the property of a device; users expect it to be the property of an account. In a market
   where a phone is often the only device and replacement is common, that expectation is not
   negotiable, and the two mitigations available (`ChatBackup`, `HistoryTransfer`) both
   require the old device to be alive — the one assumption a lost phone violates. §12.4a
   reports the trade in full. State the general form: **the binding constraint on end-to-end
   encryption in consumer products is device loss, not law enforcement and not compliance**,
   and any design that treats compliance as the adversary will still lose to a dropped
   phone.

5. **An invariant verified by tracing is weaker than an invariant enforced by construction,
   and the difference is measurable.** Invariant 4 was verified as holding in August by
   tracing every documented money path, and every path traced did take its row lock. Three
   wallet writers took none — they were simply not on a documented path. Making the lock
   structurally unavoidable (§5.4a) turns "we checked and it was fine" into "there is no
   way to write this wrong", which is the difference between an audit result and a design
   property. Generalise it: a chokepoint that owns the dangerous operation eliminates a
   defect class, while an audit that finds every instance of it eliminates a defect list.
6. **A type system is a defect-detection instrument, not a style preference.** With no CI
   job running it, the mobile typecheck had drifted to 893 errors — and buried in the noise
   were two live defects shipping to users: eighteen overlays silently stripped of their
   positioning by a React Native API that no longer exists, and a Copy button that threw on
   every press. Neither is reachable by a unit test (nothing asserts on style objects), and
   Metro strips types without checking them, so the build stayed green throughout. This is a
   concrete, quantified answer to "was the missing CI job actually costing anything" — and a
   better argument for static analysis than any appeal to best practice.

7. **Dead code in a permissive TypeScript configuration is invisible, and that is a second
   argument for the same instrument.** When the E2EE send path was retired,
   `encryptForAllDevices` lost its last caller and seven imports were orphaned. The project
   does not set `noUnusedLocals`, so all of it compiled silently — and verifying that each
   import was genuinely unused had to be done by reading, because the compiler had been
   configured not to say. A codebase can therefore carry a retired cryptographic
   implementation that still typechecks, still passes tests, and is reachable from nothing.

8. **The platform surfaces are the strategic contribution.** A wallet is a product; a
   wallet with an OAuth identity, a checkout API, marketplace splits and a mini-app runtime
   is a platform. Discuss the network-effect argument and the corresponding increase in
   attack surface (T6, T7).
