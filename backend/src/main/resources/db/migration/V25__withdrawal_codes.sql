-- Workstream D: one-time withdrawal codes. A customer generates a code for a
-- cash-out amount; an agent redeems it to release cash. Only the SHA-256 hash of
-- the code is stored. Redemption is the proof of payment — an agent can never
-- debit a customer wallet directly.

CREATE TABLE IF NOT EXISTS withdrawal_codes (
    id                   UUID PRIMARY KEY,
    user_id              UUID NOT NULL,
    amount               NUMERIC(15, 2) NOT NULL,
    code_hash            VARCHAR(64) NOT NULL UNIQUE,
    status               VARCHAR(20) NOT NULL,
    expires_at           TIMESTAMP NOT NULL,
    redeemed_by_agent_id UUID,
    created_at           TIMESTAMP,
    redeemed_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_codes_user ON withdrawal_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_codes_status ON withdrawal_codes (status);
