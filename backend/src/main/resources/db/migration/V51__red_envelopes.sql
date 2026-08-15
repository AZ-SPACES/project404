-- Akyede — a gift of money addressed to one person.
--
-- The sender is debited in full when the gift is sent and the money sits in the gift
-- until the recipient opens it or it expires, so an unopened gift is customer money that
-- has left a wallet and reached none. ReconciliationService counts it in the safeguarding
-- snapshot for the same reason it counts payment_holds.
--
-- The gift is addressed: recipient_id is the only account allowed to open it, and
-- claim_code is only how that person reaches it, never a bearer token for the money.

CREATE TABLE IF NOT EXISTS red_envelopes (
    id               UUID PRIMARY KEY,
    version          BIGINT,
    claim_code       VARCHAR(22)    NOT NULL UNIQUE,
    sender_id        UUID           NOT NULL,
    recipient_id     UUID           NOT NULL,
    chat_id          UUID,
    message_id       UUID,
    amount           NUMERIC(15, 2) NOT NULL,
    currency         VARCHAR(3)     NOT NULL DEFAULT 'GHS',
    refunded_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    occasion         VARCHAR(24),
    message          VARCHAR(140),
    status           VARCHAR(20)    NOT NULL DEFAULT 'UNOPENED',
    transaction_id   UUID,
    expires_at       TIMESTAMP      NOT NULL,
    created_at       TIMESTAMP,
    opened_at        TIMESTAMP,
    settled_at       TIMESTAMP,

    CONSTRAINT red_envelopes_amount_positive CHECK (amount > 0),
    -- A gift may never pay out more than went into it, whichever way it settled.
    CONSTRAINT red_envelopes_refund_within_amount CHECK (refunded_amount <= amount),
    -- Nobody gifts themselves; that would be a free way to park money outside the
    -- daily limit and pull it back at will.
    CONSTRAINT red_envelopes_not_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_red_envelopes_sender ON red_envelopes (sender_id);
CREATE INDEX IF NOT EXISTS idx_red_envelopes_recipient ON red_envelopes (recipient_id);
CREATE INDEX IF NOT EXISTS idx_red_envelopes_status_expires ON red_envelopes (status, expires_at);

-- No chat_messages column is added here. A gift card in a thread is E2EE JSON the client
-- seals and sends as an ordinary message — the server never links a message to a gift, so
-- a column for it would only ever be null. It also happens that no migration creates
-- chat_messages at all, so altering it here would fail outright on a fresh database.
