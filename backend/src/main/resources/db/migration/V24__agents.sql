-- Workstream C: the agent network. An agent is a user who can exchange physical
-- cash for wallet balance. Their float is their existing primary wallet, so a
-- cash-in/out is just an internal wallet-to-wallet transfer. Cash-in commission
-- (which AZA pays) accrues here as a tracked payable rather than as e-money, so
-- the safeguarding invariant (issued e-money = safeguarded balance) is preserved.

CREATE TABLE IF NOT EXISTS agents (
    id                            UUID PRIMARY KEY,
    user_id                       UUID NOT NULL UNIQUE,
    code                          VARCHAR(20) UNIQUE,
    status                        VARCHAR(20) NOT NULL,
    tier                          VARCHAR(20) NOT NULL,
    location                      VARCHAR(255),
    float_limit                   NUMERIC(15, 2),
    cash_in_commission_bps        INTEGER NOT NULL DEFAULT 20,    -- 0.20% of deposit
    cash_out_commission_share_bps INTEGER NOT NULL DEFAULT 5000,  -- 50% of the cash-out fee
    commission_accrued_ghs        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at                    TIMESTAMP,
    updated_at                    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
