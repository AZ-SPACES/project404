-- Super-agent (master-agent) tier. A super agent holds float and pushes it down to the
-- standard agents beneath them, so the network can be topped up without finance minting
-- e-money for every till individually.
--
-- Distribution is an internal float-wallet-to-float-wallet move: no e-money is created or
-- destroyed, so the safeguarding invariant (issued e-money = safeguarded balance) holds
-- untouched. It is also strictly no-margin — the amount that leaves the master's float is
-- the amount that lands in the sub-agent's, with no spread and no commission accrual on
-- either side. Commission stays a matter between AZA and the agent who served the customer.

-- ── Hierarchy ───────────────────────────────────────────────────────────────────
-- Nullable: every existing agent keeps a NULL parent and reports to nobody, which is the
-- correct reading of the network as it stands today.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES agents(id);

CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents (parent_agent_id);

-- A one-level guard only. It stops the degenerate self-parent; it cannot stop a longer
-- cycle (A→B→A), which is enforced in SuperAgentService where the whole chain is visible.
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_parent_not_self;
ALTER TABLE agents ADD CONSTRAINT agents_parent_not_self
    CHECK (parent_agent_id IS NULL OR parent_agent_id <> id);

-- ── Distribution ledger ─────────────────────────────────────────────────────────
-- One row per float movement between a master and one of its sub-agents. RECALL is the
-- same move in reverse, for pulling idle float back up before a settlement run.
CREATE TABLE IF NOT EXISTS float_distributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_agent_id  UUID NOT NULL REFERENCES agents(id),
    sub_agent_id    UUID NOT NULL REFERENCES agents(id),
    direction       VARCHAR(12) NOT NULL,             -- DISTRIBUTE | RECALL
    amount          NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'GHS',
    transaction_id  UUID,                             -- the ledger row this movement wrote
    idempotency_key VARCHAR(255) UNIQUE,
    note            VARCHAR(500),
    performed_by    UUID,                             -- userId of the master agent operator
    created_at      TIMESTAMP,
    CONSTRAINT float_distributions_distinct_parties CHECK (super_agent_id <> sub_agent_id),
    CONSTRAINT float_distributions_direction_check CHECK (direction IN ('DISTRIBUTE', 'RECALL'))
);

CREATE INDEX IF NOT EXISTS idx_float_distributions_super
    ON float_distributions (super_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_float_distributions_sub
    ON float_distributions (sub_agent_id, created_at DESC);

-- ── Ledger type ─────────────────────────────────────────────────────────────────
-- transactions.type carries a CHECK listing the values that existed when the column was
-- created; FLOAT_DISTRIBUTION is new, so the check has to admit it before the first
-- distribution can be written. Recreated from the current TransactionType enum (see the
-- same pattern in V50).
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('TRANSFER', 'REQUEST', 'CASH_IN', 'CASH_OUT',
                    'MERCHANT_PAYMENT', 'BILL_PAY', 'PAYOUT', 'DISBURSEMENT',
                    'FLOAT_DISTRIBUTION'));
