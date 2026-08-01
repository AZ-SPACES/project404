# Payment Holds (Manual Release) — Implementation Plan

**Status:** Design complete, not built
**Date:** 2026-08-01 (revision 2)
**Supersedes:** revision 1 of this document (vocabulary corrected, compatibility section added, one live security bug promoted to hotfix)

---

## 1. What this is

A payment can settle two ways: **automatically** at confirmation (today's behavior), or it can be **held** until the integrating platform calls `release`.

That is the whole feature, and the sentence above is the whole docs summary.

### Naming is a design decision

The API contains **zero service-domain nouns**. The primitive is *"the authorized party released,"* not *"the service is done."* Aza never learns what was being paid for.

Revision 1 named the field `settlement: INSTANT | HELD`. That collides with an existing concept: `/api/v1/merchant/settlements` already means merchant payout batches ([MerchantSettlementController.java:23](backend/src/main/java/com/aza/backend/controller/MerchantSettlementController.java:23)), and "settlement" appears ~20 times in the developer guides with that meaning. One word, two unrelated meanings in one API is a documentation and support tax forever. Corrected vocabulary:

| Rejected (domain-coupled) | Rejected (collides) | **Adopted** |
|---|---|---|
| `POST /escrow/complete` | — | `POST /sessions/{id}/release` |
| `settlementMode: ESCROW` | `settlement: HELD` | `release: MANUAL` (vs `AUTOMATIC`, the default) |
| "service completed" | — | "release authorized" |
| `escrow.released` | `settlement.released` | `hold.released` |
| `autoReleaseAfterDays` | — | `maxHoldDays` |

`release: "MANUAL"` also closes the vocabulary on itself: the field names the endpoint you must call.

The integrator's domain lives entirely in `reference` (`job_8812`, `booking_44`, `invoice_9`) and `metadata` — fields Aza stores, echoes in webhooks, and never interprets.

**"Escrow" is a marketing word.** Use it on the marketing site where it does explanatory work. It does not appear in the API, the schema, or the developer guides.

---

## 2. Locked decisions

| # | Decision |
|---|---|
| 1 | **Release authority is the integrator.** They call `release` or `refund`; Aza executes. |
| 2 | **Release is immediate** on the release call. There is no completion-window timer. |
| 3 | **Aza has no jurisdiction over merits.** See §5. |
| 4 | **Stale holds auto-refund the payer** at `maxHoldDays`, fee returned in full. |
| 5 | **Every party must already have an Aza account.** No claim flow for unregistered recipients. |
| 6 | **BoG permits the hold.** Record the basis in the compliance file. |
| 7 | **Vocabulary is `release: AUTOMATIC \| MANUAL`** — domain-free and collision-free (rev 2). |

### Why stale holds refund rather than release

Absence of a release call is absence of evidence that anything was earned. Refunding the payer restores the status quo ante and is the only outcome Aza can defend without forming an opinion it is not entitled to hold.

---

## 3. Verified findings

Checked against the codebase on 2026-08-01. These constrain the plan.

### 3.1 Only three primitives are reachable with an API key

`MerchantApiKeyFilter` activates on exactly three path prefixes — `/api/v1/merchant/sessions`, `/connect`, `/transactions` ([MerchantApiKeyFilter.java:38-41](backend/src/main/java/com/aza/backend/security/filter/MerchantApiKeyFilter.java:38)). Everything else resolves the merchant from a dashboard JWT.

| Primitive | API key? | Notes |
|---|---|---|
| Automatic (instant) | Yes | `POST /sessions` |
| Split (Connect) | Yes | `POST /sessions` + `splits`, `/connect/transfers` |
| Transaction verification | Yes | `GET /transactions/{id}` |
| **Hold / manual release** | — | To build |
| Payout | **No** | `/merchant/payouts` uses `User` principal, outside the filter prefixes |
| Invoices | **No** | [MerchantInvoiceController.java:31](backend/src/main/java/com/aza/backend/controller/MerchantInvoiceController.java:31) |
| Recurring transfers | **No** | `/api/v1/recurring-transfers` — not under `/merchant/` at all |
| Payment requests | **No** | `/api/v1/payment-requests` — same |

An integrator today can take money in and split it. They cannot get it out, bill for it, or schedule it.

### 3.2 Two endpoints inside the API-key prefix are broken for API-key callers

`POST /sessions/{id}/refund` and `POST /sessions/{id}/expire` sit inside the activated prefix, so the filter runs and sets a **`Merchant`** principal ([MerchantApiKeyFilter.java:119](backend/src/main/java/com/aza/backend/security/filter/MerchantApiKeyFilter.java:119)). But both handlers declare `@AuthenticationPrincipal User user` ([MerchantController.java:362](backend/src/main/java/com/aza/backend/controller/MerchantController.java:362), [:212](backend/src/main/java/com/aza/backend/controller/MerchantController.java:212)), so `user` injects `null` and `requireMerchant(user.getId())` throws.

**An API-key call to refund returns a 500, not a 401.** This is live today.

The working pattern is `@AuthenticationPrincipal Object principal` + `resolveMerchantId(principal)` ([MerchantController.java:545](backend/src/main/java/com/aza/backend/controller/MerchantController.java:545)), which handles both `User` and `Merchant`.

### 3.3 🔴 HOTFIX — cross-tenant idempotency disclosure (live security bug)

`findByIdempotencyKey(String)` is **not scoped by merchant** ([CheckoutSessionRepository.java:23](backend/src/main/java/com/aza/backend/repository/CheckoutSessionRepository.java:23)), and `createSession` returns any hit directly ([CheckoutService.java:91-95](backend/src/main/java/com/aza/backend/service/CheckoutService.java:91)):

```java
CheckoutSession existing = sessionRepository.findByIdempotencyKey(request.getIdempotencyKey()).orElse(null);
if (existing != null) return toResponse(existing, merchant);
```

If merchant B sends an idempotency key merchant A already used, **B receives A's session** — id, amount, description, checkout URL. The global unique constraint blocks the insert; the lookup returns before reaching it.

**Fix (one commit, ship before everything else in this plan):**
1. Repository: `findByMerchantIdAndIdempotencyKey(UUID, String)`; service passes the caller's merchant id.
2. Migration: replace the global unique constraint with `UNIQUE (merchant_id, idempotency_key)` (duplicate-check first).

These must land together. Scoping only the lookup leaves the constraint rejecting legitimate cross-merchant keys; relaxing only the constraint widens the leak from "read A's session" to "collide with A's session." No integrator can legitimately depend on the old behavior — anyone who observed it was observing a leak.

### 3.4 There is no way to get a user onto Aza from inside an integrator's app

[SIGN_IN_WITH_AZA.md](SIGN_IN_WITH_AZA.md) is 669 lines of authentication for users who already exist. No occurrence of signup, registration, or onboarding. The QR flow structurally requires the Aza mobile app already installed ([:85](SIGN_IN_WITH_AZA.md:85)). The scope table ([:65](SIGN_IN_WITH_AZA.md:65)) — `identity`, `email`, `phone`, `wallet:read`, `payment` — contains nothing that provisions an account.

Every mode except automatic settlement to the integrator's own balance requires the recipient to already exist. **This, not the hold mechanics, is the adoption bottleneck.**

### 3.5 Session creation is rate-limited to 200/merchant/hour

`rateLimitService.enforceRateLimit("merchant:sessions:" + merchantId, 200, Duration.ofHours(1))` ([CheckoutService.java:79](backend/src/main/java/com/aza/backend/service/CheckoutService.java:79)). Undocumented. Held sessions consume the same budget.

### 3.6 Wildcard webhook subscribers receive all new event types

`isSubscribed()` treats `*` as match-everything ([CheckoutService.java:608](backend/src/main/java/com/aza/backend/service/CheckoutService.java:608)). Integrators subscribed to `*` will start receiving `hold.*` events the day this ships. Not a code change — a communication item (§8).

---

## 4. API contract

```
POST /api/v1/merchant/sessions               release: "MANUAL"          [sessions:write]
POST /api/v1/merchant/sessions/{id}/release  Idempotency-Key required   [sessions:write]
POST /api/v1/merchant/sessions/{id}/refund   Idempotency-Key required   [sessions:write]
GET  /api/v1/merchant/sessions/{id}          includes hold block        [sessions:read]
```

Nested under `/sessions` deliberately — inherits the existing scope check with no filter changes. Currency: GHS only in v1, mirroring Connect.

**Create a held session**

```json
{
  "amount": 250.00,
  "release": "MANUAL",
  "maxHoldDays": 30,
  "reference": "job_8812",
  "recipients": [
    { "recipient": "+233241234567", "amount": 200.00, "note": "Milestone 1" }
  ]
}
```

- `release` defaults to `AUTOMATIC` — today's behavior, absent field means nothing changes.
- `maxHoldDays`: integer 1–90, default 30 (ceiling pending business sign-off, §10).
- The integrator keeps `amount − recipients − azaFee`. Creation fails with `RECIPIENT_NOT_FOUND` if any recipient has no Aza account — before the payer is ever charged.
- **The hold comes into existence at payment confirmation** (when funds leave the payer), not at session creation. Before payment, the session's existing 30-minute expiry governs; an unpaid held session expires exactly like an unpaid instant one.

**Release** — omit `recipients` to release everything; include them for partial release.

```json
{
  "recipients": [ { "recipient": "+233241234567", "amount": 200.00 } ],
  "reason": "milestone 2 approved"
}
```

`reason` is opaque free text stored for the integrator's audit. Aza never parses it.

**Refund** — omit `amount` for full, include for partial. Cannot fail while held. On full refund — including expiry auto-refund — the Aza fee is returned in full; on partial release the fee is taken pro-rata on the released portion only.

**Webhooks** — opt-in via the existing `isSubscribed()` mechanism (but see §3.6 for `*` subscribers).

`hold.created` · `hold.released` · `hold.partially_settled` · `hold.refunded` · `hold.expiring` (T-7, T-1) · `hold.expired_refunded` · `hold.release_failed` · `hold.frozen`

**State machine**

```
payer pays ─► HELD ─integrator: release─► RELEASED (immediate)
               │
               ├─integrator: refund────► REFUNDED (immediate)
               │
               ├─partial release+refund─► PARTIALLY_SETTLED
               │
               ├─Aza compliance────────► FROZEN (clock stops; blocks both)
               │
               └─expires_at reached────► REFUNDED (event: hold.expired_refunded)
                  (warnings at T-7, T-1)
```

**Backwards compatibility:** `release` defaults to `AUTOMATIC`. Every existing integration is untouched. Full compatibility analysis in §8.

---

## 5. Liability model

Aza cannot see whether work happened, so it must never rule on whether it did.

| Question | Answered by | Mechanism |
|---|---|---|
| Was the work done? | **Integrator** | Their evidence — chat logs, GPS, photos, ratings. They call `release` or `refund`. |
| Was it held? Released? When? By which key? | **Aza** | `hold_events`, exposed to both parties |
| Fraud, sanctions, frozen account, legal order? | **Aza** | `FROZEN` status — blocks release *and* refund until compliance clears |
| Nobody called anything for `maxHoldDays`? | **Aza** | Auto-refund the payer |

There is **no Aza-adjudicated dispute state.** `FROZEN` is compliance-only and is the sole circumstance in which Aza acts on a hold of its own initiative outside expiry.

### Three non-code deliverables that follow

1. **Payer-facing disclosure at checkout.** The payer is handing money to Aza's brand and will complain to Aza when a job goes wrong. The held checkout page must state who decides release *before* they confirm. Without it, support inherits merits disputes Aza has just decided it cannot adjudicate.
2. **Support playbook.** Give the payment facts, refer merits to the integrator, escalate only fraud. Ships with Phase 1.
3. **Legal, before the first integrator signs.** The integrator warrants it holds release authority and indemnifies Aza for release decisions. Aza's protection is the audit trail, not its judgment. Long lead time — start now.

---

## 6. Data model

```sql
-- V44__payment_holds.sql
-- NOTE: the idempotency constraint change shipped EARLIER, in the §3.3 hotfix
-- (V43__scope_checkout_idempotency_per_merchant.sql, commit 40ea677).

ALTER TABLE checkout_sessions
  ADD COLUMN release VARCHAR(16) NOT NULL DEFAULT 'AUTOMATIC';

CREATE TABLE payment_holds (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL REFERENCES checkout_sessions(id),
    merchant_id       UUID NOT NULL REFERENCES merchants(id),
    payer_user_id     UUID NOT NULL REFERENCES users(id),
    amount            NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    released_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
    refunded_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
    aza_fee           NUMERIC(15,2) NOT NULL,
    status            VARCHAR(24) NOT NULL DEFAULT 'HELD',
    frozen_reason     VARCHAR(500),
    expires_at        TIMESTAMP NOT NULL,
    test_mode         BOOLEAN NOT NULL DEFAULT FALSE,
    held_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMP,
    CHECK (released_amount + refunded_amount <= amount)
);

CREATE INDEX idx_payment_holds_merchant     ON payment_holds (merchant_id, held_at DESC);
CREATE INDEX idx_payment_holds_status_expiry ON payment_holds (status, expires_at);  -- scheduler scan

CREATE TABLE hold_recipients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hold_id         UUID NOT NULL REFERENCES payment_holds(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    identifier      VARCHAR(255) NOT NULL,
    amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    released_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status          VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    failure_reason  VARCHAR(500),
    transaction_id  UUID,
    CHECK (released_amount <= amount)
);

CREATE INDEX idx_hold_recipients_hold ON hold_recipients (hold_id);
CREATE INDEX idx_hold_recipients_user ON hold_recipients (user_id);

-- Append-only. Never updated, never deleted.
CREATE TABLE hold_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hold_id         UUID NOT NULL REFERENCES payment_holds(id),
    event_type      VARCHAR(32) NOT NULL,
    amount          NUMERIC(15,2),
    actor_type      VARCHAR(16) NOT NULL,   -- PLATFORM | ADMIN | SYSTEM
    api_key_id      UUID,                   -- deliberately NOT an FK: audit rows must survive key deletion/rotation
    reason          VARCHAR(500),           -- integrator's text, never parsed
    idempotency_key VARCHAR(255),
    transaction_id  UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT hold_events_hold_idem UNIQUE (hold_id, idempotency_key)
);

CREATE INDEX idx_hold_events_hold ON hold_events (hold_id, created_at);

ALTER TABLE safeguarding_snapshots ADD COLUMN held_float NUMERIC(15,2) NOT NULL DEFAULT 0;
```

### Why a ledger table rather than a wallet

Held money is owned by nobody. A payer does not own money they have committed; a recipient does not own money they have not earned. Modelling it as a `Wallet` would force a synthetic owner and confuse the audit story. The `WalletType` enum precedent (`AGENT_FLOAT`) does not apply — an agent genuinely owns their float.

`api_key_id` on the event row is load-bearing: *"which of your keys released this"* is a question you will be asked, and `MerchantApiKeyFilter` already has the key entity in hand.

### Concurrency rules (binding on every code path)

1. **Every mutation locks the hold row first** — `SELECT … FOR UPDATE` on `payment_holds` before any wallet lock. This serialises release vs. refund vs. the expiry scheduler on the same hold; without it, a release racing the scheduler's auto-refund can pay a recipient *and* refund the payer.
2. **Then the established wallet order:** merchant → recipient wallets sorted by UUID → payer wallet, matching [CheckoutService.java:855](backend/src/main/java/com/aza/backend/service/CheckoutService.java:855).
3. **The expiry scheduler uses the same service method** as an API refund (actor `SYSTEM`), never a parallel code path — one implementation, one set of locks, one event trail.

---

## 7. Gap register

### Blockers

| # | Gap | Fix |
|---|---|---|
| G1 | **Held float invisible to safeguarding.** `variance = safeguarding − customerFloat − merchantFloat` ([ReconciliationService.java:93](backend/src/main/java/com/aza/backend/service/ReconciliationService.java:93)) counts neither. Every hold fakes a surplus and masks real breaches by exactly the held float | Add a `heldFloat` term and column; ship in the same PR as the hold logic, not as a follow-up |
| G2 | **Recipient lookup cannot resolve phone numbers.** `findByEmailIgnoreCaseOrUsername` ([CheckoutService.java:161](backend/src/main/java/com/aza/backend/service/CheckoutService.java:161)); Ghanaian workers identify by phone | `resolveRecipient()` normalizing via the `V42__normalize_ghana_phone_numbers` helper: phone → email → username. Back-port into `resolveSplits()` and `ConnectService.resolveRecipient()` so all three agree |
| G3 | **`@AuthenticationPrincipal User` breaks API-key calls** (§3.2) — live 500 | Switch refund and expire to `Object principal` + `resolveMerchantId`. All new endpoints use this pattern from day one |
| G4 | **Double-release on retry.** Integrators retry aggressively on timeout | `Idempotency-Key` mandatory on release and refund, enforced by the `hold_events` unique constraint. Replay returns the original result, 200, no money moved. Reject with `IDEMPOTENCY_KEY_REQUIRED` if absent — never optional on money-moving endpoints |
| G5 | **No account provisioning** (§3.4) | Phased — see §7.1 |
| G12 | **Cross-tenant idempotency disclosure** (§3.3) — upgraded from "constraint too strict" to live security bug in rev 2 | Scoped lookup + per-merchant constraint, one commit, ships as a hotfix ahead of all phases |

### Correctness

| # | Gap | Fix |
|---|---|---|
| G6 | **`FALLBACK_TO_PLATFORM` is wrong here.** Instant checkout gives an unpayable seller's money to the platform ([CheckoutService.java:198](backend/src/main/java/com/aza/backend/service/CheckoutService.java:198)) — correct there, but in a hold it hands the integrator money a worker earned | No fallback path on release. Failure keeps funds held, emits `hold.release_failed`, alerts ops. Write this as an explicit test |
| G7 | **Recipient can go inactive or frozen mid-hold** | Validate at creation (hard fail before the payer is charged) *and* re-validate at release |
| G8 | **Deadlock / double-spend on concurrent release, refund, and expiry** | Concurrency rules in §6: hold-row lock first, then the established wallet order; scheduler shares the API code path |
| G9 | **Fee timing** | Quote `aza_fee` at capture against `feeRateBps`; pro-rata on partial release; returned in full on any full refund, including expiry ([CheckoutService.java:875](backend/src/main/java/com/aza/backend/service/CheckoutService.java:875) precedent) |
| G10 | **No invariant on held funds** | Nightly job asserting `SUM(active holds) == SUM(hold_events)`. Drift opens a `ReconBreak` of type `HELD_DRIFT` and pages finance. This is the tripwire for a release bug silently double-paying |
| G11 | **Expiry** | `HoldExpiryScheduler` on the [HeldTransferTimeoutScheduler](backend/src/main/java/com/aza/backend/scheduler/HeldTransferTimeoutScheduler.java) hourly-cron pattern: `hold.expiring` at T-7 and T-1, refund at `expires_at`. `FROZEN` stops the clock |

### API and documentation

| # | Gap | Fix |
|---|---|---|
| G13 | **Rate limit undocumented** (§3.5) | Publish the number, add `X-RateLimit-Remaining` headers, make the cap a per-merchant `SystemSetting` so it can be raised without a deploy |
| G14 | **Two error envelopes.** Controllers return `{success, data}`; the API-key filter returns `{"status":"error","error":{"message":…}}`. The `azaFetch` sample in the guides reads `body.message` and gets `undefined` on exactly the auth failure integrators hit first | Converge on the controllers' envelope — the filter's shape appears only on 401/403 error paths, so the blast radius is parsers of auth failures, the smallest possible. Dated changelog entry + integrator notice; no silent cutover. See §8 |
| G15 | **Documented error codes do not exist.** `INVALID_API_KEY`, `MERCHANT_NOT_ACTIVE`, `WEBHOOK_URL_UNREACHABLE`, `INVOICE_NOT_DRAFT` are absent from the backend; `SESSION_ALREADY_PAID` is documented backwards | Generate the table from source. Holds ship real codes: `HOLD_NOT_ACTIVE`, `HOLD_ALREADY_SETTLED`, `HOLD_FROZEN`, `RECIPIENT_NOT_FOUND`, `RECIPIENT_UNPAYABLE`, `RELEASE_EXCEEDS_HELD`, `IDEMPOTENCY_KEY_REQUIRED` |
| G16 | **Most primitives are dashboard-only** (§3.1) | Extend `MerchantApiKeyFilter` across `/api/v1/merchant/**` and convert handlers to `Object principal`. **Scope policy (rev 2):** invoices/webhooks/settlements-read become available to secret keys as today's session endpoints are; **`payouts:write` is never implicit** — it requires a restricted key that explicitly carries it. Payout is the drain-to-bank capability; a leaked secret key today cannot move money out of Aza, and extending the filter must not silently change that. Decide separately whether `/recurring-transfers` and `/payment-requests` move under a merchant-scoped path or stay consumer-only |
| G17 | **No sandbox for the hold lifecycle.** `POST /sessions/{id}/simulate` covers test payment only | `release` and `refund` honour `test_mode` — full state machine and webhooks, no money |
| G18 | **No mode-selection guidance.** Integrators will reach for holds when automatic is what they want, then report funds stuck | Decision page at the top of the guide: *"Use manual release only when money should be paid to someone after something happens. If money just lands in your account, use the default."* |
| G19 | **P2P onboarding copy is false.** [OnboardingScreen.tsx:30](aza/src/features/onboarding/screens/OnboardingScreen.tsx:30) promises "escrow protection … safe until the recipient accepts" on P2P transfers. P2P settles irreversibly on PIN confirmation with no acceptance step, and this plan does not change that — it is the merchant rail | Rewrite the copy. Not a code change, but it stays false after this ships |

### 7.1 G5 in detail — provisioning

Three steps, increasing cost:

1. **Phase 1 — deep link.** `/recipients/resolve` returns a `signupUrl` carrying the integrator's name, a prefilled normalized phone, and `return_to`. The integrator renders "Ask your worker to finish setup." Solves nothing structurally but makes the flow explainable and unblocks pilots.
2. **Phase 3 — invite API.** `POST /api/v1/merchant/recipients/invite` creates a pending invite, SMSes the deep link, and fires `recipient.registered` when the account goes live. The integrator can then create a job before the worker exists, and hold creation stops being a hard fail.
3. **Post-launch — hosted onboarding.** The Stripe Connect equivalent. Collides with KYC policy and account-creation rules; needs compliance design, not just engineering.

**Verify in Phase 1:** a recipient appears able to *receive* without KYC — `creditSplits` checks only ACTIVE + wallet + not frozen, while `confirmPayment` requires `KycStatus.VERIFIED` to *pay*. If withdrawal is KYC-gated (likely, in `UserWithdrawalService`), an invited worker can be paid but cannot cash out, and the invite copy must say so. Confirm before writing that copy.

---

## 8. Compatibility with existing integrators

What in this plan touches someone who has already integrated, and how each is handled.

| Change | Impact on existing integrators | Handling |
|---|---|---|
| All hold vocabulary (`release`, `/release`, `hold.*`, tables) | **None.** Nothing renamed has ever shipped; `release` defaults to `AUTOMATIC` | — |
| §3.3 idempotency hotfix | Behavioral: a key that previously collided cross-merchant (returning someone else's session) now creates your own session | No notice needed — the old behavior was a leak; no legitimate dependence is possible |
| G3 principal fix | Refund/expire via API key: 500 → works | Strictly better; note in changelog |
| G14 envelope convergence | **Breaking** for integrators parsing the filter's `{status, error}` shape on 401/403 | Smallest possible blast radius (auth-error paths only), but still: dated changelog, direct notice to all keyholders, 30-day lead before cutover |
| G16 filter extension | Secret keys gain invoices/webhooks/settlement-read access. **Payouts stay opt-in** (`payouts:write` on restricted keys only) | Announce as a feature; the payout carve-out prevents a silent security regression |
| `hold.*` webhook events | Integrators subscribed to `*` receive event types they've never seen (§3.6) | Heads-up notice; docs already tell handlers to ignore unknown events — add that line if missing |
| Rate-limit publication (G13) | None — documenting existing behavior | — |

Rule for everything above: **no silent cutovers on anything an integrator's parser can see.** Changelog + notice + lead time, even when the blast radius is small.

---

## 9. Delivery

| Phase | Scope | Gaps closed | Estimate |
|---|---|---|---|
| **Hotfix — now, before Phase 0** | Scoped idempotency lookup + per-merchant constraint, one commit | G12 | 1–2 days |
| **0 — Make the grid true** | API-key filter across `/merchant/**` (payouts opt-in), `Object principal` fix, envelope convergence with notice period, real error codes | G3, G14, G15, G16 | 1–1.5 wks |
| **1 — Core holds** | Migration, `HoldService`, hold/release/refund, phone resolution, safeguarding fix, webhooks, sandbox, payer disclosure, support playbook | G1, G2, G4, G6–G9, G17 | 2–3 wks |
| **2 — Safety** | Expiry scheduler (shared code path per §6), `FROZEN` compliance path, admin views, partial release, reconciliation invariant | G10, G11 | 2 wks |
| **3 — Adoption** | Recipient invite API, merchant dashboard UI, guides and decision page, rate-limit publication, onboarding copy fix | G5, G13, G18, G19 | 2–3 wks |

**Sequencing notes**

- The hotfix is not part of the feature. It is a live cross-tenant disclosure and ships immediately regardless of what happens to the rest of this plan.
- Phase 0 ships alone and is worth doing whether or not holds proceed — it fixes a live 500 and makes the documented API true.
- Phases 1 and 2 ship together publicly. A hold with no expiry path is a support incident, not a product.
- Phase 3 is **not optional polish.** Without provisioning, holds only work for integrators whose users happen to already be on Aza.
- Legal drafting (§5) runs in parallel from Phase 0 — it is the long pole before the first integrator signs.

---

## 10. Open items

1. **`maxHoldDays` ceiling.** Recommendation: default 30, hard cap 90. Longer holds mean a larger safeguarding liability and a bigger refund cliff; 90 covers rentals and milestone work without becoming an open-ended custody product. Needs business sign-off, not engineering.
2. **Should `release` require its own scope?** Under `sessions:write`, any key that can create a session can move held money to recipients. Acceptable for v1 (it can only move money along the path the hold already defines); a large integrator will eventually want release restricted to a separate key, which needs a filter branch and a key-rotation story.
3. **Do `/recurring-transfers` and `/payment-requests` become integrator-facing?** They are currently consumer endpoints outside `/merchant/`. Exposing them is a larger change than adding scopes.
