-- Workstream E: float lifecycle. E-money is minted to an agent's float wallet
-- only against a verified bank deposit, and burned when bank money is wired out —
-- both under maker-checker. This keeps the safeguarding invariant intact:
-- issued e-money = balance of the safeguarded bank account.

CREATE TABLE IF NOT EXISTS float_movements (
    id             UUID PRIMARY KEY,
    agent_id       UUID NOT NULL,
    type           VARCHAR(10) NOT NULL,   -- MINT | BURN
    amount         NUMERIC(18, 2) NOT NULL,
    bank_reference VARCHAR(255),
    performed_by   UUID,
    created_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_float_movements_agent ON float_movements (agent_id);

-- Surface agent float as its own line on the daily safeguarding snapshot. It is a
-- subset of customer_float (agents are users with wallets), shown for visibility —
-- the variance formula still uses customer_float + merchant_float.
ALTER TABLE safeguarding_snapshots
    ADD COLUMN IF NOT EXISTS agent_float NUMERIC(18, 2) NOT NULL DEFAULT 0;
