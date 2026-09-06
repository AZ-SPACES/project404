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
