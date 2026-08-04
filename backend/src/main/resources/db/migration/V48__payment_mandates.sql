-- Direct debit: a user authorizes a merchant once (via a mini-app or Sign-in-with-AZA), and the
-- merchant's own backend can then charge the mandate on demand, server-to-server, with no
-- passcode per charge. perChargeLimit/periodLimit are the safety ceilings enforced on every
-- charge; periodSpent/periodResetAt are reset lazily by PaymentMandateService rather than swept
-- by a scheduler.

CREATE TABLE payment_mandates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id       UUID NOT NULL REFERENCES merchants(id),
    payer_user_id     UUID NOT NULL REFERENCES users(id),
    per_charge_limit  NUMERIC(18,2) NOT NULL CHECK (per_charge_limit > 0),
    period_limit      NUMERIC(18,2) CHECK (period_limit IS NULL OR period_limit > 0),
    period_type       VARCHAR(16),
    period_spent      NUMERIC(18,2) NOT NULL DEFAULT 0,
    period_reset_at   TIMESTAMP,
    expires_at        TIMESTAMP,
    reference         VARCHAR(255) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
    source_type       VARCHAR(16) NOT NULL,
    source_id         VARCHAR(100) NOT NULL,
    last_charged_at   TIMESTAMP,
    approved_at       TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (period_limit IS NULL OR period_type IS NOT NULL)
);

CREATE INDEX idx_payment_mandates_payer    ON payment_mandates (payer_user_id, status);
CREATE INDEX idx_payment_mandates_merchant ON payment_mandates (merchant_id, status);

-- Append-only: every charge attempt, including failures, so a merchant's history explains
-- itself (ceiling hit, insufficient funds, mandate not active) without cross-referencing logs.
CREATE TABLE mandate_charges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandate_id       UUID NOT NULL REFERENCES payment_mandates(id),
    merchant_id      UUID NOT NULL,
    amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    idempotency_key  VARCHAR(255) NOT NULL,
    status           VARCHAR(16) NOT NULL,
    transaction_id   UUID,
    failure_reason   VARCHAR(500),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT mandate_charges_merchant_idem UNIQUE (merchant_id, idempotency_key)
);

CREATE INDEX idx_mandate_charges_mandate ON mandate_charges (mandate_id, created_at DESC);
