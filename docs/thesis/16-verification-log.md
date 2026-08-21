# 16. Verification Log

Every claim in this documentation set that could be checked mechanically was checked on
**2026-08-21** against commit `8440c51` (branch `Home`). This file records the command, the
result and the verdict, so the thesis can cite verification rather than assertion — and so
a marker can re-run it.

The pass produced **three findings in the backend and two latent runtime bugs in the mobile
client**. All five have since been **fixed and covered by tests**; the original diagnosis is
kept below alongside the remedy, because the diagnosis is the part with thesis value.

> **Read this as a narrative, not a checklist.** The sequence — write down the invariants,
> check them mechanically, find that two of nine did not hold, fix them, prove the fix with
> a test — *is* the methodological contribution of Chapter 3. A verification pass that finds
> nothing demonstrates nothing.

---

## 16.1 Summary

| # | Claim under test | Verdict at audit | Status now |
|---|---|---|---|
| V1 | `AgentCashService` idempotency is tenant-scoped | ✅ Closed — ownership guard present | ✅ |
| V2 | Wallet locks are acquired in a canonical order | ⚠️ **F1** — only in `AgentCashService` | ✅ **Fixed** — shared `WalletLocker`, 7 tests |
| V3 | Passcode brute force is throttled | ✅ 5 attempts / 5-minute Redis window | ✅ |
| V4 | The mobile client pins certificates | ✅ Root-CA pinning, both platforms, expiry valve | ✅ |
| V5 | Webhooks are signed, retried, SSRF-guarded | ✅ HMAC-SHA256, 7 attempts, private-address rejection | ✅ |
| V6 | Invariant 5 — `BigDecimal` only near money | ✅ No `double`/`float` on any amount | ✅ + schema-level assertion |
| V7 | Invariant 7 — GHS-only, no FX path | ✅ No FX code, no non-GHS literals | ✅ |
| V8 | Invariant 2 — effects fire after the debit **commits** | ⚠️ **F2** — effects fired pre-commit | ✅ **Fixed** — `AfterCommitExecutor`, 5 tests |
| V9 | Invariant 8 — no margin on super-agent float | ⚠️ **F3** — governs code that no longer exists | ⚠️ Retained as a forward constraint |
| V10 | Maker–checker rejects self-approval | ✅ Rejected outright, including for ADMIN | ✅ |
| V11 | No `.env` was ever committed | ✅ Clean across all history | ✅ |
| V12 | Backend test suite passes | ✅ 355 tests, 36 classes | ✅ **374 tests, 40 classes** |
| V13 | Mobile test suite runs | ⚠️ Not runnable; **no mobile CI job** | ✅ **Fixed** — 254 tests, CI job added |
| V14 | Schedulers safe on multiple instances | ❌ No ShedLock or leader election | ⚠️ Unchanged — single-instance by design |
| V15 | Mobile app typechecks | ⚠️ **893 errors**; 2 were live runtime bugs | ✅ **Fixed** — 0 errors, typecheck in CI |
| V16 | Migrations apply to an empty database | ⚠️ Never tested — H2 only | ✅ **Fixed** — `MigrationChainIT` on real PostgreSQL |
| V17 | Concurrent debits cannot double-spend | ⚠️ Argued, never demonstrated | ✅ **Fixed** — `ConcurrentTransferIT`, measured |
| V18 | Backend coverage is instrumented | ❌ No JaCoCo | ✅ **Fixed** — money classes 62.5% lines |

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

### F3 — Invariant 8 governs code that no longer exists

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

## 16.4 Re-running this log

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
```
