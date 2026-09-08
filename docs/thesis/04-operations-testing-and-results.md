# 10. Delivery Engineering and Operations

## 10.1 Continuous integration

`.github/workflows/ci.yml` runs on **every branch push** and on PRs to `main`, with
`cancel-in-progress` concurrency so superseded runs are killed.

| Job | What it does |
|---|---|
| `backend-test` | Java 21 (Temurin), Maven cache, `mvn test` excluding `**/*ApplicationTests.java`. Surefire reports uploaded as an artifact on failure. |
| `backend-docker` | Buildx build of the backend image (no push) with GitHub Actions layer cache — validates that the image compiles, not just the tests. Depends on `backend-test`. |
| `frontend-ci` | Matrix over `aza-web`, `aza-admin`, `aza-merchants`, `aza-pay`, `aza-superagents`, `fail-fast: false`. Node 22, npm cache keyed on each app's lockfile, then `npm run lint` and `npm run build` with the app's build-time `NEXT_PUBLIC_*` values. |
| `mobile-test` | **Added after the verification pass (closes F5).** Node 22, `npm install` from the workspace root, `tsc -p tsconfig.ci.json --noEmit`, then Jest with coverage uploaded as an artifact — **326 tests across 24 suites** as of 2026-09-06, up from 254 across 17 when the job was added. |

> ### The gap this closed, and what it had been hiding
>
> Until this job existed, the matrix covered only the Next.js apps. **Nothing in CI ran
> the mobile app at all** — not its typecheck, not its 17 Jest suites, not its 20 Maestro
> flows.
>
> That mattered more than it first appeared, for two reasons.
>
> **First**, the mobile suite is what tests the cryptography — `x3dh.test.ts`,
> `e2ee.test.ts`, `keystore.test.ts`, `mediaCrypto.test.ts`, `backupCrypto.test.ts`. The
> evidence behind the platform's strongest security claims was not exercised by any
> automated gate, so an E2EE regression could reach `main` unchallenged.
>
> **Second — and this is the part worth writing up** — when the typecheck was finally run it
> reported **893 errors**, and two of them were live runtime bugs that had been shipping:
>
> - `StyleSheet.absoluteFillObject` **does not exist in React Native 0.86**. Eighteen call
>   sites spread it into a style object, and spreading `undefined` is silently legal in
>   JavaScript — so eighteen overlays (KYC scan frames, the image cropper, the drawing
>   canvas, several modal backdrops) quietly lost their absolute positioning in the RN
>   upgrade. No crash, no failing test, no error in the log.
> - `Clipboard.setString` does not exist in `expo-clipboard`; only `setStringAsync` does. The
>   Copy button on the bill-forwarding screen threw a `TypeError` every time it was pressed.
>   The very next line of the same function already used `setStringAsync` correctly.
>
> Neither defect is reachable by a unit test — nothing asserts on style objects — and Metro
> strips types without checking them, so the build stayed green. **Only a typechecker finds
> these, and nothing was running one.** That is the concrete cost of the missing gate, and
> it is a far better argument for CI discipline than any appeal to best practice.

Two decisions worth explaining in the thesis:

- **`BackendApplicationTests` is excluded from CI.** The Spring context test requires a
  live database and full environment; excluding it keeps CI hermetic. State it as a
  deliberate trade-off (faster, more reliable CI; no context-load verification) rather than
  leaving a marker to find it.
- **`fail-fast: false` on the frontend matrix.** One app's lint failure should not hide the
  other four's results.

### Recurring CI failure modes (documented, not rediscovered)

Captured in `.claude/skills/ci-doctor/SKILL.md`. These are good, concrete "lessons learned"
content for Chapter 6:

1. **Env-dependent tests.** CI runs `mvn test` with **no `.env` file**, so `spring-dotenv`
   loads nothing. A test that passes locally and fails in CI with a missing-property error
   needs the property in test config (`application-test.yml` / `@TestPropertySource`), not
   in `.env`. This exact failure occurred with the payment-proof HMAC property.
2. **Lockfile missing platform binaries.** A `package-lock.json` generated on macOS can
   lack the Linux native optional-dependency blocks — hit in `aza-admin` with Tailwind's
   oxide binary, producing a CI-only `Cannot find module @tailwindcss/oxide-linux-*`.
3. **React Compiler lint rules** that do not surface in the editor — previously hit in the
   merchants portal's document-capture component.
4. **A schema assertion that over-matched.** `MigrationChainIT.moneyColumnsAreExactDecimals`
   (added by the audit remediation to enforce invariant 5 at the schema level) flagged
   boolean flags as non-exact money columns, failing CI on a correct migration
   (`c4110795`). Worth recording as a small counterweight to §12.8's argument for mechanical
   gates: a gate that is wrong is a gate that gets disabled, so the cost of a false positive
   in a blocking check is higher than its nuisance value suggests.
5. **Integration containers started per test class.** The Testcontainers suite was booting a
   fresh stack for every IT class rather than once (`fa7fac90`), and the integration profile
   needed a real Redis to boot at all (`48ffcb0b`). Both are the ordinary cost of moving
   integration tests into CI, and both are worth a sentence because the naive expectation is
   that a passing local suite transfers unchanged.

The stated method is: *never debug CI by pushing guess commits.* Pull the failing log with
`gh run view <id> --log-failed`, read the **first** real error (Maven and Next.js both bury
the root cause above pages of follow-on noise), reproduce with the exact CI command, fix,
verify locally, push once.

## 10.2 Continuous deployment

`.github/workflows/deploy.yml`. Triggered by `workflow_run` on a **successful** CI run on
`main`, or manually via `workflow_dispatch`. The `if:` guard checks
`github.event.workflow_run.conclusion == 'success'` — a red CI cannot deploy.

The deploy step SSHes into the droplet and:
```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.backend.yml"
git pull origin main                                  # authenticated, retried — see below
SENTRY_RELEASE=$(git rev-parse --short HEAD) $COMPOSE up --build -d --remove-orphans
# wait for backend health=healthy, 180s deadline, dump logs and fail on timeout
# assert every required service is running and not unhealthy
# compare Docker restart counters across a 15s window to catch a crash loop
$COMPOSE exec -T nginx nginx -t                       # config syntax gate
$COMPOSE exec -T nginx grep -q "listen 443" .../default.conf   # TLS-is-configured gate
docker image prune -f
```

The two nginx assertions after the rollout are a small but genuine safety property: the
deploy fails loudly if the reverse proxy came up with an invalid config or without TLS.

### The gate that printed its evidence and never read it (`d853d9aa`)

The deploy ran `docker compose ps` and printed the result — but never looked at it. **`ps`
exits 0 whether a container is up, dead, or restarting in a loop**, so a service that died
on a bad config deployed "successfully" and stayed broken until someone happened to check.
The step *looked* like a verification step in the log, which is worse than having no step at
all: it produced exactly the artefact a reader would take as evidence.

The coturn service (§4.5) is precisely the shape of thing that would have slipped through.
Its config file is gitignored, so a missing or malformed copy on the droplet kills the
container with nothing failing anywhere — and in the event it restarted **201 times** before
this gate caught it.

The replacement asserts three things, and the reason there are three is that no one of them
is sufficient:

1. **Backend health, polled rather than slept on.** The old gate waited a fixed 15 seconds
   and accepted `health=n/a`; now that the container has a healthcheck it would just as
   happily have accepted `health=starting`. The deploy now polls until Docker reports
   `healthy`, with a 180-second deadline, and dumps the last 60 log lines on failure. The
   backend healthcheck aggregates the datasource and Redis via `/actuator/health`, so
   "healthy" means the app can actually serve, not merely that the JVM is alive.
   `start_period: 120s` exists because Flyway runs every pending migration before the port
   opens, so the first probe must not start counting failures against a boot that is
   working.
2. **Container state.** Exited or `restarting` fails; `unhealthy` fails; `starting` is
   tolerated so slow starters like Postgres do not trip it.
3. **Restart counters across a settle window.** A crash-looping container reads as
   "running" the instant after it restarts, so **state alone cannot distinguish a healthy
   service from one dying every few seconds.** Comparing Docker's `RestartCount` across a
   15-second window is what separates them.

The gate is scoped to `postgres redis backend nginx` — the services this box actually
serves. The Next.js apps are on Vercel and disabled by the overlay, but `ps` still lists
containers left over from older deploys, and asserting on those would fail the deploy over a
service that is *meant* to be down. coturn is deliberately excluded for the opposite reason:
TURN runs as a host service, Docker cannot see it, so requiring it would fail every deploy.
Both exclusions are the interesting part — a health gate has to know the difference between
"absent because broken" and "absent because it lives somewhere else".

### Authenticating the pull — two failure modes pulling in opposite directions

Small, and worth including because it is a good example of a fix that has to satisfy two
contradictory constraints (`07c749b8`, then `b28fc1ad`):

1. A **stale credential stored on the droplet** made GitHub answer 401 rather than serving
   this public repository anonymously. Git prompted for a username, found no TTY, and the
   deploy died on its very first command with `could not read Username`.
2. Forcing the pull anonymous to dodge that ran straight into GitHub rate-limiting
   unauthenticated downloads.

The resolution empties the credential-helper chain — so whatever is stored on the box stays
out of it — and supplies the workflow run's own `GITHUB_TOKEN` instead, passed as an
`http.extraheader` rather than in the remote URL so it never lands in the reflog or in
`.git/config`. The token is minted per run and dies with it, so nothing durable is left on
the droplet. `GIT_TERMINAL_PROMPT=0` guarantees git can never again block on input, and
three attempts with backoff absorb transient failures.

### Verified gap — the deploy script and the documented target have diverged

Read `deploy.yml` against `.claude/skills/deploy-preflight/SKILL.md` and three differences
fall out. Report them as a known gap with a concrete remediation; a marker rewards that far
more than silence.

| Aspect | Documented target | What `deploy.yml` actually does | Status |
|---|---|---|---|
| Image build | Built in CI, pushed to **GHCR** (`ghcr.io/az-spaces`); the server only pulls | `docker compose up --build` — **builds on the droplet**, competing with the live service for CPU and memory | ⚠️ open |
| Rollout | Zero-downtime via **docker-rollout**, healthcheck-gated cutover, nginx reload | `up -d`, then a **healthcheck poll** with a 180 s deadline plus a state-and-restart-counter gate. Containers still restart in place, so there is a brief outage — but a failed rollout now fails the deploy | ◐ **partly closed**: the healthcheck gate exists, the zero-downtime cutover does not |
| Auth | Key-based SSH | `appleboy/ssh-action` with `DEPLOY_PASSWORD` — **password SSH** | ⚠️ open |

The two verification steps that *are* present are worth crediting, because they are a real
safety property most student deploys lack: after the rollout the workflow runs
`nginx -t` and asserts `listen 443` is configured, so the deploy fails loudly if the reverse
proxy came up with an invalid config or without TLS.

Remediation, in priority order: (1) switch to key-based SSH; (2) ~~replace the fixed sleep
with a healthcheck poll~~ — **done, `d853d9aa`**; (3) move the build into CI and push to
GHCR, which is what would make a docker-rollout cutover possible at all, since a
zero-downtime swap needs an image that already exists.

Report the partial closure rather than either the original gap or a clean bill of health.
The remaining two items are the ones that need infrastructure changes (a deploy key, a
registry pull credential on the droplet) rather than workflow edits, which is why the one
that was fixable in the workflow was fixed first — an ordering worth stating, since it is
the ordinary economics of operational debt rather than a judgement about severity.

## 10.3 Schema management

The single most important operational discipline in the project.

- **Flyway owns the schema.** 62 versioned migrations, `V1__baseline.sql` → `V64`
  (numbering is not contiguous). `MigrationChainIT` replays the whole chain against a real
  PostgreSQL 16 in CI, so a migration that only works against an already-migrated database
  fails before it reaches the droplet.
- **`spring.jpa.hibernate.ddl-auto=validate`.** Hibernate may never alter the schema; it
  only checks that entity mappings match what Flyway produced. An entity change without a
  matching migration **fails boot**, converting a class of production drift into a build
  failure.
- **`baseline-on-migrate=true`, `baseline-version=32`.** This is the interesting part.
  Production databases had been built by the old `ddl-auto=update` and already contained
  every object the migrations describe, but had no Flyway history. Baselining stamps such a
  database at V32 and then applies only migrations *above* it, so historical V2–V32 scripts
  — several of which are one-shot data migrations and **not replay-safe** — never re-run.
  A fresh, empty database ignores the baseline and runs the full V1→V32 chain. Document
  this: adopting Flyway on a live, previously-unmigrated database is a real migration
  problem with a non-obvious solution, and it is exactly the kind of thing a thesis can
  contribute.

### Migration failure modes actually encountered

The recent commit history is a case study in the hazards of adopting migrations over an
inferred schema, and is worth a table in Chapter 6:

| Commit | Failure |
|---|---|
| `8c14e9d` | V12 insert relied on a column default that a `ddl-auto`-created table never had |
| `837d412` | V51 altered a table that no migration creates |
| `ce75d7f` | V51's comment named the wrong table (`chat_messages` vs `messages`) |
| `8440c51` | V50 retyped store sales through a `CHECK` constraint that forbade the new type |
| `ec3c104` / `V57` | A stale `ddl-auto`-era column blocked every transaction until relaxed |
| `V31`, `V34`, `V38` | Three separate migrations exist purely to drop stale `CHECK` constraints inherited from the `ddl-auto` era |
| `V58` | `transactions_type_check` had to be widened before the first `FLOAT_DISTRIBUTION` could be written — **anticipated**, because the pattern was already documented from `V50` |
| `V64` | The same trap on `transactions.status`, **not** anticipated, and found in production: a stale CHECK rejected `HELD_FOR_REVIEW`, so no high-risk transfer could be held (§6.7) |

The generalisable lesson: **a schema inferred from entities is not a schema you can
migrate against**, because the objects it created (defaults, check constraints, types)
differ from what an explicit migration would have produced, and those differences surface
only at the moment a later migration touches them.

**`V58` and `V64` are the same trap caught from opposite ends, and the pair is the more
interesting evidence.** By `V58` the pattern was documented well enough that the author
widened the constraint pre-emptively in the same migration that introduced the new
enum value — a documented failure mode successfully preventing its own recurrence. `V64` is
the counter-example: `HELD_FOR_REVIEW` had been added to the `TransactionStatus` enum long
before, by someone not thinking about migrations at all, because **adding an enum constant
does not look like a schema change**. It reached production and broke the fraud hold.

Two conclusions the thesis can defend from this pair:

1. Documenting a failure mode works, but only for the people who are looking at the
   document. `V58`'s author was writing a migration and consulted the migration rules;
   `HELD_FOR_REVIEW`'s author was editing a Java enum.
2. The durable fix is not documentation but **detection**: a check that enumerates
   `CHECK` constraints on enum-backed columns and compares them against the current Java
   enums would have caught both, and is a concrete, small piece of future work (§13).

The `V64` remedy also shows the care these drops require: it matches on `conkey` rather than
on the constraint text, so only single-column CHECKs on `status` are touched — `transactions`
also carries `type` and `recipient_type` constraints that a text match would have swept up.

### Migration authoring rules
From `.claude/skills/new-migration/SKILL.md` and `deploy-preflight`:
- Next version number, correct `V<N>__snake_case_name.sql` naming.
- Every migration must be **backward-compatible with the currently running backend**, since
  old code runs against the new schema during rollout. Column drops, renames and
  `NOT NULL` additions without defaults are blocked.
- `IF NOT EXISTS` / `IF EXISTS` guards throughout, so a partially-adopted database converges.

## 10.4 Deploy preflight

`.claude/skills/deploy-preflight/SKILL.md` defines a pre-deploy gate producing a single
PASS/FAIL table; any FAIL blocks until resolved or explicitly waived:

1. **Migrations** — list migrations newer than production; check each for rollout
   backward-compatibility; grep the diff for `@Entity`/`@Column` changes without a matching
   `V<N>__*.sql`.
2. **Environment variables** — grep the diff for `${`, `System.getenv`, `process.env` and
   new compose keys; any new required variable must exist on the server first.
3. **Images** — confirm GHCR builds succeeded.
4. **Rollout readiness** — healthchecks passing, nginx reload path clear.

## 10.5 TLS and DNS

- `api.aza.systems` — Let's Encrypt via **HTTP-01 webroot** (`scripts/init-api-ssl.sh`).
  TLS 1.2/1.3 only, an explicit ECDHE/AES-GCM/ChaCha20 cipher list, session tickets off,
  HSTS `max-age=63072000`.
- Mini-app hosts — wildcard via **DNS-01** with the Cloudflare plugin
  (`scripts/init-miniapps-ssl.sh`).
- The certbot container renews every 12 hours in a loop:
  `while :; do certbot renew --quiet; sleep 12h; done`.
- **Real client IP restoration.** `nginx/conf.d/cloudflare-real-ip.conf` plus the backend's
  `TRUSTED_PROXY_IPS` (`172.16.0.0/12`, loopback). Without this, every per-IP control
  (rate limits, reputation, admin allowlist) would see the proxy's address — or worse,
  trust a spoofed `X-Forwarded-For`.
- WebSocket support in nginx: `proxy_http_version 1.1`, `Upgrade`/`Connection` headers,
  `proxy_read_timeout 86400s` so long-lived STOMP connections are not culled.

## 10.6 Observability and operations

- Structured logging via `logback-spring.xml`; `SENTRY_RELEASE` is stamped from the git
  short SHA at deploy so errors are attributable to a commit.
- `/actuator/**` is permitted for health probes.
- `AdminHealthController`, `AdminMerchantHealthController` and the admin `health`/`monitor`
  pages expose operational state in-product.
- Nine scheduled jobs run in-process (`scheduler/`): auto-payout, back-office batch,
  bill-payment reconciliation, held-transfer timeout, history-transfer cleanup, hold
  expiry, location retention, recurring splits, red-envelope expiry.
- `CircuitBreakerConfig` guards outbound provider calls; `AsyncConfig` isolates non-critical
  work (notifications, risk evaluation) from the request thread.
- `AdminBootstrapRunner` creates the first admin from `ADMIN_BOOTSTRAP_EMAIL` — the
  chicken-and-egg problem of a system where every admin must be created by an admin.

### Scaling limitation to state explicitly
`WEBSOCKET_LOCAL_DELIVERY=true` in production skips the Redis hop and delivers events
straight to the local STOMP session. This is correct **only on a single backend instance**.
The Redis fan-out path exists (`RedisPubSubConfig`, `RedisMessageSubscriber`) and must be
switched on before scaling horizontally. Because the schedulers also run in-process, a
second instance would double-execute them. **Verified: there is no ShedLock, no
`@SchedulerLock`, and no leader election anywhere in `scheduler/` or `config/`** — so all
nine jobs would fire on every instance simultaneously. Auto-payout and hold-expiry running
twice are money-affecting, not merely wasteful.

Both are real, bounded, well-understood limitations — say so, with the fix (ShedLock backed
by the existing PostgreSQL or Redis, plus the Redis fan-out flag), rather than claiming the
system scales horizontally today.

## 10.7 Secrets management

Injected as environment variables by Compose from a server-side `.env`, never committed.
Rotation is documented at `backend/docs/SECRETS_ROTATION.md`. The Cloudflare API token for
DNS-01 lives in a gitignored `./secrets` mount because it is needed at **renewal** time,
not only at issuance. Firebase credentials are mounted read-only into the container at
`/etc/aza/firebase-service-account.json`.

**Verified clean.** No `.env` file appears anywhere in the history of any branch:

```bash
git log --all --full-history --oneline -- '**/.env' '.env'
# → no output
```

The Firebase service-account JSON is mounted read-only at deploy time rather than baked into
an image, and the Cloudflare DNS-01 token lives in a gitignored `./secrets` mount. No secret
has needed emergency rotation for exposure.



---

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


---

# 12. Results and Evaluation

Traceability, invariant conformance, the security matrix and **correctness under
concurrency (§12.5)** are complete and verified against the codebase, first on 2026-08-21
and **re-verified on 2026-09-06 at commit `9678fa5a`** — method and commands in
`05-limitations-glossary-and-appendices.md` (§16.5 covers the second pass). Three sections remain for you to
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
| 7 | Evaluation | This chapter + `05-limitations-glossary-and-appendices.md` (18 mechanical checks, plus the §16.5 re-verification) | Invariant conformance ✅ **9 of 9**, security matrix ✅, backend suite ✅ **509/509** (7 Docker-gated skips), mobile ✅ **326/326** with a clean typecheck. Performance, usability and comparative evaluation still to run | **Partially met** |

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
Method and commands in `05-limitations-glossary-and-appendices.md`.

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
