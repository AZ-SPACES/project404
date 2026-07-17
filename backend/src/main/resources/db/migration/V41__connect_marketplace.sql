-- Aza Connect (marketplace) tables.
--
-- Two ways a platform gets money to its sellers:
--   1. connect_transfers      — platform pushes funds from its merchant balance to an
--                               individual seller's Aza wallet on demand (collect-then-disburse).
--   2. checkout_session_splits — at checkout, part of a buyer's payment is credited straight
--                               to each seller's wallet, the platform keeps the remainder.
-- Both are internal wallet movements settled inside Aza (Ghana/GHS only, v1).

-- ── Direct platform → seller transfers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connect_transfers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id           UUID NOT NULL REFERENCES merchants(id),
    recipient_user_id     UUID REFERENCES users(id),
    recipient_identifier  VARCHAR(255) NOT NULL,
    amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency              VARCHAR(3) NOT NULL DEFAULT 'GHS',
    note                  VARCHAR(500),
    reference             VARCHAR(255),
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    failure_reason        VARCHAR(500),
    transaction_id        UUID,
    test_mode             BOOLEAN NOT NULL DEFAULT FALSE,
    -- Per-merchant idempotency: a key is unique within one merchant so two platforms
    -- can independently reuse their own keys without colliding.
    idempotency_key       VARCHAR(255),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at          TIMESTAMP,
    CONSTRAINT connect_transfers_merchant_idem_key UNIQUE (merchant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_connect_transfers_merchant
    ON connect_transfers (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connect_transfers_recipient
    ON connect_transfers (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_connect_transfers_reference
    ON connect_transfers (merchant_id, reference);

-- ── Per-seller splits of a checkout payment ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkout_session_splits (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
    recipient_user_id     UUID REFERENCES users(id),
    recipient_identifier  VARCHAR(255) NOT NULL,
    amount                NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    note                  VARCHAR(500),
    -- PENDING at creation → CREDITED once the seller wallet is funded at confirm,
    -- or FALLBACK_TO_PLATFORM if the seller became unpayable and the amount stayed
    -- with the platform (so a buyer's payment is never blocked by a bad seller).
    status                VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    failure_reason        VARCHAR(500),
    transaction_id        UUID,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkout_session_splits_session
    ON checkout_session_splits (session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_session_splits_recipient
    ON checkout_session_splits (recipient_user_id);
