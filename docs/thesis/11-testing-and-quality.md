# 11. Testing and Quality Assurance

## 11.1 Test strategy

Four layers, each with a different job:

| Layer | Tooling | Count | In CI? | What it protects |
|---|---|---|---|---|
| Backend unit/service tests | JUnit 5, Mockito, H2, `spring-security-test` | 36 classes, 367 tests | ✅ | The money invariants and business rules |
| **Backend integration tests** | **Testcontainers + PostgreSQL 16** | **2 classes, 7 tests** | ✅ | **Migrations, constraints, row locking, concurrency** |
| Mobile unit tests | Jest, React Native Testing Library | 17 suites, 254 tests | ✅ | Cryptography, stores, utilities |
| Mobile typecheck | `tsc --noEmit` | 387 files | ✅ | Type-level defects invisible to tests and to Metro |
| Mobile E2E | Maestro | 20 flows | ❌ | The critical user journeys on a device/emulator |
| Web lint + build | ESLint (incl. React Compiler rules), TypeScript, `next build` | 4 apps | ✅ | Compile-time and lint-time defects |

### Measured results (2026-08-21)

```bash
cd backend && mvn -q test -Dsurefire.excludes="**/*ApplicationTests.java"
cd aza && npm test -- --coverage
```

| Suite | Result |
|---|---|
| Backend | **374 tests, 40 classes, 0 failures, 0 errors** (7 Docker-gated ITs skip locally) |
| Mobile | **254 tests, 17 suites, 0 failures** |
| Mobile typecheck | **0 errors** (was 893) |

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

## 11.2 Backend test inventory (40 classes)

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
| Backend tests passing | **374 / 374** (40 classes; 7 Docker-gated skip locally) | `mvn test` |
| Backend suite runtime | ≈ 2 min | measured |
| **Backend line coverage — whole backend** | **22.61%** (branches 17.36%) | JaCoCo |
| **Backend line coverage — money classes** | **63.31%** (branches 46.40%) | JaCoCo, 13 classes |
| Mobile tests passing | **254 / 254** (17 suites) | `npm test` |
| Mobile typecheck errors | **0** (was 893) | `tsc -p tsconfig.ci.json` |
| **Mobile coverage — `src/crypto`** | **87.76%** statements, 72.09% branches, 89.19% functions | Jest |
| Mobile coverage — all instrumented files | 47.85% statements | Jest, 25 files |
| Mean CI duration | — | `gh run list --workflow=CI --limit 20` |
| CI pass rate, last 50 runs | — | `gh run list --workflow=CI --limit 50 --json conclusion` |

### Reading these numbers honestly

Three caveats, each of which is better stated by you than found by an examiner.

**1. Report the money-path figure and the aggregate, and explain the gap.** 22.61% overall
reflects 100 services covering everything from birthday greetings to Unsplash image search.
63.31% on the money path reflects where the effort was deliberately spent. Neither number
alone is the truth. The two weakest money classes, `TransferService` (52%) and
`CheckoutService` (35%), are also the two largest — 810 and 673 lines — and are the honest
targets for the next round.

**2. The mobile aggregate has a misleading denominator.** Jest instruments only files a test
actually imports — 25 of 387. So 47.85% is coverage *of the tested subset*, not of the
codebase. Either add `collectCoverageFrom` to get a true denominator, or quote the crypto
figure and describe the rest qualitatively. Do not present 47.85% as whole-codebase
coverage.

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
| No mobile CI job | `mobile-test` job — typecheck, 254 tests, coverage artifact |
| Mobile suite not runnable | `npm install` from the workspace root; documented in the job |
| No integration tests against real PostgreSQL | `MigrationChainIT` + `ConcurrentTransferIT` via Testcontainers |
| No automated concurrency test | `ConcurrentTransferIT` — 100 parallel debits, measured |
| No deadlock test / non-canonical lock ordering | `WalletLocker` + 7 unit tests + a bidirectional IT |
| No test that effects are deferred past commit | `AfterCommitExecutor` + 5 unit tests |
| No backend coverage instrumentation | JaCoCo, report uploaded by CI |

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
