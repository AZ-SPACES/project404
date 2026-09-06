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

