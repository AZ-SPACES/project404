# 11. Testing and Quality Assurance

## 11.1 Test strategy

Four layers, each with a different job:

| Layer | Tooling | Count | In CI? | What it protects |
|---|---|---|---|---|
| Backend unit/service tests | JUnit 5, Mockito, H2, `spring-security-test` | 51 classes, 502 tests | ✅ | The money invariants and business rules |
| **Backend integration tests** | **Testcontainers + PostgreSQL 16** | **2 classes, 7 tests** | ✅ | **Migrations, constraints, row locking, concurrency** |
| Mobile unit tests | Jest, React Native Testing Library | 24 suites, 326 tests | ✅ | Cryptography, stores, utilities |
| Mobile typecheck | `tsc --noEmit` | 410 files | ✅ | Type-level defects invisible to tests and to Metro |
| Mobile E2E | Maestro | 20 flows | ❌ | The critical user journeys on a device/emulator |
| Watch (Swift) | XCTest | 2 classes | ❌ | **Never compiled** — the watchOS platform components are not installed (§7.7) |
| Web lint + build | ESLint (incl. React Compiler rules), TypeScript, `next build` | 5 apps | ✅ | Compile-time and lint-time defects |

### Measured results (re-run 2026-09-06 at `9678fa5a`)

```bash
cd backend && mvn -q test -Dsurefire.excludes="**/*ApplicationTests.java"
cd aza && npm test -- --coverage
```

| Suite | 2026-08-21 | **2026-09-06** |
|---|---|---|
| Backend | 374 tests, 40 classes, 0 failures | **509 tests, 53 classes, 0 failures, 0 errors** (7 Docker-gated ITs skip locally) |
| Mobile | 254 tests, 17 suites, 0 failures | **326 tests, 24 suites, 0 failures** |
| Mobile typecheck | 0 errors (was 893) | **0 errors** |

**+135 backend tests and +72 mobile tests in sixteen days**, and the composition matters more
than the count: the additions are concentrated on exactly the paths the invariant re-reading
opened up — `WalletLedgerTest`, `SuperAgentServiceTest`, `ApprovalLockingTest`,
`TransactionReversalTest`, `RecurringTransferExecutorTest`, `UserWithdrawalServiceTest`,
`FloatServiceTest`, plus the first backend coverage chat has ever had
(`ChatServiceMessageBodyTest`, `ChatServiceBroadcastTest`, `MessageContentCipherTest`).

Quote these rather than estimates. Reproduce the backend aggregate with:

```bash
cat backend/target/surefire-reports/*.txt | grep -E "^Tests run" \
  | awk -F'[:,]' '{t+=$2;f+=$4;e+=$6;s+=$8} END {printf "Tests %d, Fail %d, Err %d, Skip %d\n",t,f,e,s}'
```

> **On the 7 skipped:** the integration tests carry
> `@Testcontainers(disabledWithoutDocker = true)`, so they skip where no Docker daemon is
> running and execute in CI, where one always is. **Skipped is not passed** — cite the CI
> run, not a local one, when you report them.

**Testing philosophy to state:** the backend tests are not distributed for coverage; they
are concentrated on the money path and its adjacent hazards. That is the right priority for
a fintech, and you should defend it against the "your line coverage is low" objection by
pointing at *what* is tested rather than *how much*.

## 11.2 Backend test inventory (53 classes)

Grouped by what they defend:

**Money movement and limits**
- `TransferServiceTest` — the core transfer path
- `LimitGuardTest` — tier/override limit enforcement
- `DailySentTotalTest` — daily aggregate correctness (the input to the daily cap)
- `FeeCalculationServiceTest`, `FeeServiceStatsTest` — fee rules, thresholds, caps
- `UserWithdrawalServiceTest` — the flow the June 2026 audit found broken

**Idempotency and multi-tenancy**
- `CheckoutIdempotencyScopeTest` — proves an idempotency key is scoped per merchant
- `MerchantApiKeyFilterTest`, `ApiKeySurfaceConversionTest` — key authentication and surface
- `ConnectServiceTest` — marketplace splits and transfers

**Holds and settlement**
- `HoldServiceTest`, `HoldExpiryTest` — manual release and stale-hold auto-refund
- `HoldLedgerAuditServiceTest` — held funds never break the ledger
- `SafeguardingHeldFloatTest` — held funds are still counted for safeguarding
- `CheckoutHoldSandboxTest`, `CheckoutRefundSplitTest` — refunding a split payment

**Agent network**
- `AgentServiceTest`, `AgentCashServiceTest`, `FloatServiceTest`
- `CashStructuringTest` — the smurfing heuristic

**Social money**
- `ExpenseSplitServiceTest`, `RecurringSplitServiceTest`, `RedEnvelopeServiceTest`
- `RecipientInviteServiceTest`, `RecipientResolverTest`, `PromoControllerTest`

**Concurrency and transaction discipline** *(added after the verification pass)*
- `WalletLockerTest` — canonical lock ordering, including the signed-`UUID.compareTo` trap
- `AfterCommitExecutorTest` — effects fire on commit, never on rollback
- `MigrationChainIT` — the real Flyway chain against real PostgreSQL
- `ConcurrentTransferIT` — the double-spend experiment

**Identity, compliance and platform**
- `AuthServiceTest`, `OtpServiceTest`, `KycServiceTest`, `MerchantServiceTest`
- `PresenceServiceTest`, `ImageServiceTest`, `BirthdayServiceTest`
- `BillPaymentServiceTest`
- `MiniAppBundleServiceTest`, `MiniAppCatalogSyncTest`

**Added since 2026-08-21** *(13 classes, and each one names a defect it was written for)*

| Class | What it defends |
|---|---|
| `WalletLedgerTest` (14) | The chokepoint's arithmetic, validation and audit write, plus the locked/unlocked entry-point contract (§5.4a) |
| `SuperAgentServiceTest` (17) | Invariant 8 — no margin, no e-money created, downline scoping, required master-scoped idempotency |
| `ApprovalLockingTest` | Payment approvals take a pessimistic lock |
| `TransactionReversalTest` | Reversals lock, and credit a frozen wallet deliberately |
| `RecurringTransferExecutorTest` | Recurring transfers are atomic and idempotent |
| `MerchantFeeCalculatorTest` | Pricing-plan resolution, band selection, the per-merchant override outranking the plan |
| `MessageContentCipherTest` (8) | AES-256-GCM round trip, the `gcm1:` prefix contract, unprefixed pass-through, key-absent behaviour |
| `ChatServiceMessageBodyTest` | A body persists encrypted and returns readable; **a device holding no key material can read a history page**; deletion and expiry really remove the body rather than hiding it from one client. Uses a real `MessageContentCipher`, not a mock, because the round trip is the thing worth asserting |
| `ChatServiceBroadcastTest` | Per-recipient payloads carry the correct `isSelf` for each participant |
| `WebSocketEventLogTest` | The durable Redis-Stream recovery log and cursor replay (§4.5) |
| `RateLimitFilterActorKeyTest` | Device-before-IP keying, and the strict per-IP fallback when no device is presented (§6.4) |
| `PasscodePolicyTest` | Server-side passcode strength at every write path |
| `EmailValidationServiceTest` | Syntax, disposable-domain list, normalisation |

The `ChatServiceMessageBodyTest` line is worth quoting in the thesis rather than
summarising: *"a device holding no key material can read a history page"* is a test whose
**passing** documents the withdrawal of end-to-end encryption (§12.4a). Under the old
design it would necessarily have failed. A test that asserts the absence of a security
property is an unusual artefact, and stating why it exists is more honest than letting the
property lapse silently.

## 11.3 Integration tests against real PostgreSQL

Added to close the gap this chapter previously reported as its top limitation. Base class
`PostgresIntegrationTest` starts one shared PostgreSQL 16 container for the whole suite; the
`integration` Spring profile sets `flyway.enabled=true`, `baseline-on-migrate=false` and
`ddl-auto=validate`.

**Booting that context is itself the strongest assertion in the suite.** With baselining
off, the application starts only if every migration from V1 applies cleanly to an *empty*
database, and Hibernate then validates every entity mapping against the result. The V50,
V51 and V57 defects would all have failed here rather than on the production droplet.

| Class | Tests | What it establishes |
|---|---|---|
| `MigrationChainIT` | 4 | Every migration applied and none failed; versions strictly ascending; nothing left pending; the ledger tables exist with `UNIQUE (user_id, type)` on wallets and `UNIQUE (idempotency_key)` on transactions; **every money column is `NUMERIC`, never floating point** |
| `ConcurrentTransferIT` | 3 | The double-spend experiment; a wallet can never go negative; bidirectional transfers do not deadlock and conserve value |

Two design notes worth reproducing:

- **`MigrationChainIT` asserts invariant 5 at the schema level.** A query over
  `information_schema.columns` fails the build if any column matching `%amount%`, `%balance%`,
  `fee_amount` or `used_amount` is not `NUMERIC`. Checking `BigDecimal` in Java is necessary
  but not sufficient — the column type is where the precision actually lives.
- **`ConcurrentTransferIT` drives the repository lock finders directly**, not
  `TransferService`. What is under test is the locking discipline, not the twenty other
  rules a full transfer applies; mixing them would make a failure ambiguous.

### The concurrency experiment

The headline measurement of the whole project, and the one that converts §5.3 from an
argument into a result:

```
100 parallel debits of GHS 1.00 from a wallet holding GHS 50.00
  → exactly 50 succeed
  → exactly 50 are rejected for insufficient funds
  → 0 errors
  → final balance exactly GHS 0.00
```

Every task is released simultaneously by a `CountDownLatch`, so the threads genuinely
contend rather than trickling through as the pool warms up. A second test oversubscribes
deliberately — 40 threads each attempting GHS 20 against a GHS 50 balance — and asserts the
balance lands on exactly GHS 10.00 and never goes negative. A third runs 60 alternating
A→B / B→A transfers and asserts zero deadlock aborts (SQLSTATE 40P01) and that the pair
still holds GHS 100.00 between them: **value is neither created nor destroyed under
contention.**

## 11.4 Cryptographic test suite

The mobile crypto tests are the ones to reproduce in an appendix, because they are the
evidence behind the security claims in Chapter 6:

| Suite | Property under test |
|---|---|
| `x3dh.test.ts` | X3DH session establishment; both parties derive the same root key |
| `e2ee.test.ts` | Envelope encrypt/decrypt, AAD binding, cross-version fallback, and the **safety-number** properties: order-independence (both parties compute the same number) and distinctness (a different peer key yields a different number) |
| `keystore.test.ts` | Key generation, `(userId, deviceId)` namespacing, OPK consumption, legacy-key migration |
| `mediaCrypto.test.ts` | Per-file key sealing; AAD binding prevents cross-purpose replay |
| `backupCrypto.test.ts` | Recovery-key encoding round-trip, including Crockford lookalike mapping (O→0, I/L→1) |
| `recoveryTotp.test.ts` | TOTP recovery |
| `encryptedMessageStore.test.ts`, `sendMedia.test.ts`, `mergeMessage.test.ts` | Ciphertext-at-rest and message merge/ordering |

Remaining mobile suites cover stores and utilities: `transferStore`, `useTransactions`,
`queryClient`, `transactionUtils`, `categories`, `validation`, `errorUtils`, `helpers`.

## 11.5 End-to-end flows (Maestro)

Twenty numbered flows in `aza/maestro/`, covering the journeys that must never break:

`01_onboarding` · `02_login_phone` · `03_login_email` · `04_trouble_login` · `05_signup` ·
`06_otp_screen` · `07_home` · `08_send_money` · `09_request_money` · `10_contacts` ·
`11_chat_list` · `12_chat_conversation` · `13_scan_qr` · `14_profile` ·
`15_security_settings` · `16_kyc_flow` · `17_setup_passcode` · `18_personal_details` ·
`19_inbox` · `20_help_support`

## 11.6 Review gates

Beyond automated tests, three human/assisted review gates run before merge or deploy.
Document these as part of the QA strategy — they cover exactly what unit tests cannot:

| Gate | Trigger | Output |
|---|---|---|
| **Money-path review** | Any diff touching wallets, transfers, payouts, withdrawals, agent float, checkout or Connect | Findings table (`Severity \| File:Line \| Invariant \| Failure scenario \| Fix`), ending in an explicit **Block** or **Approve**. Approve requires every one of the nine invariants explicitly verified — "nothing jumped out" is not approval. |
| **Deploy preflight** | Before any production deploy | PASS/FAIL table over migrations, env vars, images, rollout readiness |
| **App-store audit** | Before a store submission | 140+ rules across 32 categories (privacy, permissions, security, UI/UX, metadata, billing) |

## 11.7 Quality metrics — measured

| Metric | Value | Source |
|---|---|---|
| Backend tests passing | **509 / 509** (53 classes; 7 Docker-gated skip locally) | `mvn test` |
| Backend suite runtime | ≈ 4 min | measured |
| **Backend line coverage — whole backend** | **25.64%** (branches 21.23%), was 22.61% | JaCoCo |
| **Backend line coverage — money classes, original 13** | **63.15%** (branches 47.79%), was 63.31% | JaCoCo — the like-for-like comparison |
| **Backend line coverage — money classes, current 17** | **61.70%** (branches 47.93%) | JaCoCo, adding `WalletLedger`, `SuperAgentService`, `MerchantFeeCalculator`, `RecurringTransferExecutor` |
| Mobile tests passing | **326 / 326** (24 suites) | `npm test` |
| Mobile typecheck errors | **0** (was 893) | `tsc -p tsconfig.ci.json` |
| **Mobile coverage — `src/crypto`** | **87.75%** statements, 71.31% branches, 89.18% functions | Jest |
| Mean CI duration | — | `gh run list --workflow=CI --limit 20` |
| CI pass rate, last 50 runs | — | `gh run list --workflow=CI --limit 50 --json conclusion` |

### Reading these numbers honestly

Four caveats, each of which is better stated by you than found by an examiner.

**1. Report the money-path figure and the aggregate, and explain the gap.** 25.64% overall
reflects 116 services covering everything from birthday greetings to Unsplash image search.
The money path reflects where the effort was deliberately spent. Neither number alone is
the truth. The two weakest money classes, `TransferService` (51%) and `CheckoutService`
(35%), are still the two largest, and are still the honest targets for the next round.

**1b. The money-path figure went *down*, and that is the most instructive number in the
table.** Like-for-like on the original 13 classes it is flat (63.31% → 63.15%). Adding the
four new money classes takes it to **61.70%**, because `SuperAgentService` — 603 lines, the
newest money path — sits at 36.6% despite having 17 dedicated tests.

Resist the temptation to quote only the like-for-like figure. The drop is real and it means
something specific: **a coverage percentage over a growing set is a lagging indicator, and
new code drags it down even when the new code is tested.** The other three additions are at
97%, 100% and 90%; one large new service outweighs them. Quote both numbers, state which set
each is over, and treat `SuperAgentService` as the named target rather than letting an
aggregate hide it.

**2. The mobile aggregate has a misleading denominator, so it is no longer quoted.** Jest
instruments only files a test actually imports, which was 25 of 387 at the August
measurement — so the aggregate was coverage *of the tested subset*, not of the codebase. It
has been dropped from the table in favour of the crypto figure, which is scoped explicitly
with `--collectCoverageFrom='src/crypto/**/*.ts'` and therefore means what it says. Describe
the rest of the mobile codebase qualitatively; a number with an unstated denominator is
worse than no number.

**3. A coverage set is chosen by reading code, not by matching names.** `WalletService` was
initially counted as a money class and reported 3%, which looked alarming. It is not a money
class: its one public method is `getAppleWalletPassUrl`, a PassKit integration. Excluding it
moved the money figure from 62.47% to 63.31%. Small, but exactly the kind of methodological
detail that distinguishes a measured claim from a quoted one.

Regenerate:

```bash
cd backend && mvn test          # JaCoCo runs in the test phase → target/site/jacoco/
cd aza     && npm test -- --coverage
```

## 11.8 Known quality gaps

Six of the ten gaps this chapter originally listed have been closed. Reporting both states
is more useful than reporting only the current one, because the closures *are* the evidence
that the review method works.

### Closed

All committed on branch `Home`; see §16.4 for the commit-to-fix mapping.

| Gap | Closed by |
|---|---|
| No mobile CI job | `mobile-test` job — typecheck, now 326 tests, coverage artifact |
| Mobile suite not runnable | `npm install` from the workspace root; documented in the job |
| No integration tests against real PostgreSQL | `MigrationChainIT` + `ConcurrentTransferIT` via Testcontainers |
| No automated concurrency test | `ConcurrentTransferIT` — 100 parallel debits, measured |
| No deadlock test / non-canonical lock ordering | `WalletLocker` + 7 unit tests + a bidirectional IT |
| No test that effects are deferred past commit | `AfterCommitExecutor` + 5 unit tests |
| No backend coverage instrumentation | JaCoCo, report uploaded by CI |
| No backend test coverage for chat at all | `ChatServiceMessageBodyTest`, `ChatServiceBroadcastTest`, `MessageContentCipherTest` |
| Deploy asserted nothing about container health | Health-poll + state + restart-counter gate (§10.2) |

### Still open

1. **Maestro E2E flows are not in CI.** The 20 flows need a device or emulator; running them
   on a GitHub runner needs an Android emulator action and materially longer build times.
   The realistic answer is a nightly job rather than per-push.
2. **No load or performance testing.** No latency or throughput figures exist. This is the
   largest remaining hole in Chapter 7.
3. **No automated security scanning in CI** — no dependency-vulnerability scan
   (`npm audit`, OWASP Dependency-Check), no SAST, no secret scanning. `npm install`
   currently reports 13 high-severity advisories in the mobile dependency tree; these have
   not been triaged.
4. **Web apps have no unit tests** — lint and build only.
5. **No mutation testing**, so the strength of existing assertions is unmeasured.
6. **`BackendApplicationTests` is still excluded from CI.** With the integration profile now
   in place, the full-context boot could plausibly be folded into `MigrationChainIT`.
7. **Mini-app workspaces are excluded from the CI typecheck** via a documented stub. The
   proper fix is a shared tsconfig and hoisted dependencies for those workspaces.
8. **`SuperAgentService` is the least-covered money class at 36.6%**, despite 17 dedicated
   tests — it is 603 lines and the tests concentrate on the invariant rather than the
   surface. Named explicitly here so an aggregate cannot hide it (§11.7).
9. **Nothing has been compiled for watchOS.** The Swift targets have unit tests written
   (`WalletSnapshotTests`, `QRCodeTests`) but the platform components are not installed in
   the development Xcode, so neither those tests nor the watch app itself has ever been
   built. `watchSchemaParity.test.ts` checks the Swift/TypeScript payload contract from the
   JavaScript side, which is the only automated check currently possible across that
   boundary (§7.7).
10. **No check that enum-backed `CHECK` constraints match their Java enums.** Both `V58` and
    `V64` exist because one drifted from the other, and `V64`'s drift reached production
    (§10.3). This is a small, well-specified piece of automation that does not exist.
