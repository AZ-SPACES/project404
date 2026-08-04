-- Payment holds (manual release) — Phase 1 of HELD_SETTLEMENT_PLAN.md.
--
-- A checkout session with release_mode = 'MANUAL' debits the payer at confirmation
-- into a hold owned by nobody: the payer has committed the money, the recipients
-- have not yet earned it. The integrator settles it later by calling release (pay
-- recipients + platform remainder) or refund (payer made whole, fee returned).
-- The API field is `release`; the column is release_mode because RELEASE is a SQL
-- keyword in enough dialects to be worth avoiding.

ALTER TABLE checkout_sessions
  ADD COLUMN release_mode   VARCHAR(16) NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN max_hold_days  INTEGER;

CREATE TABLE payment_holds (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL UNIQUE REFERENCES checkout_sessions(id),
    merchant_id       UUID NOT NULL REFERENCES merchants(id),
    payer_user_id     UUID NOT NULL REFERENCES users(id),
    amount            NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    released_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
    refunded_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- Quoted against feeRateBps at capture so a later rate change cannot alter
    -- what this hold owes. Deducted at release; returned in full on refund.
    aza_fee           NUMERIC(15,2) NOT NULL,
    status            VARCHAR(24) NOT NULL DEFAULT 'HELD',
    frozen_reason     VARCHAR(500),
    expires_at        TIMESTAMP NOT NULL,
    test_mode         BOOLEAN NOT NULL DEFAULT FALSE,
    held_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMP,
    CHECK (released_amount + refunded_amount <= amount)
);

CREATE INDEX idx_payment_holds_merchant      ON payment_holds (merchant_id, held_at DESC);
-- Scheduler scan (Phase 2 expiry) and the safeguarding heldFloat sum.
CREATE INDEX idx_payment_holds_status_expiry ON payment_holds (status, expires_at);

CREATE TABLE hold_recipients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hold_id         UUID NOT NULL REFERENCES payment_holds(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    identifier      VARCHAR(255) NOT NULL,
    amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    released_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    note            VARCHAR(500),
    status          VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    failure_reason  VARCHAR(500),
    transaction_id  UUID,
    CHECK (released_amount <= amount)
);

CREATE INDEX idx_hold_recipients_hold ON hold_recipients (hold_id);
CREATE INDEX idx_hold_recipients_user ON hold_recipients (user_id);

-- Append-only settlement audit: who released/refunded what, when, under which
-- API key and idempotency key. Never updated, never deleted — this table is
-- Aza's complete answer to every question it is competent to answer about a
-- hold (payment facts), and the idempotency backstop for release/refund.
CREATE TABLE hold_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hold_id         UUID NOT NULL REFERENCES payment_holds(id),
    event_type      VARCHAR(32) NOT NULL,
    amount          NUMERIC(15,2),
    actor_type      VARCHAR(16) NOT NULL,   -- PLATFORM | ADMIN | SYSTEM
    api_key_id      UUID,                   -- no FK: audit rows must survive key rotation/deletion
    reason          VARCHAR(500),           -- integrator's free text; Aza never parses it
    idempotency_key VARCHAR(255),
    transaction_id  UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT hold_events_hold_idem UNIQUE (hold_id, idempotency_key)
);

CREATE INDEX idx_hold_events_hold ON hold_events (hold_id, created_at);

-- G1: escrowed money sits in no wallet and no merchant balance, so the
-- safeguarding variance must count it explicitly or every hold inflates the
-- apparent surplus and masks real breaches.
ALTER TABLE safeguarding_snapshots
  ADD COLUMN held_float NUMERIC(15,2) NOT NULL DEFAULT 0;
