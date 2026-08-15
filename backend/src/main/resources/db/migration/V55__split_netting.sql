-- Netting — several debts between two people collapsed into one request.
--
-- Friends who split a dinner one week and a taxi the next end up owing each other in both
-- directions. A settlement replaces every outstanding share between them with a single
-- request for the difference. Like a share, it moves no money of its own: it is one more
-- ordinary money request, so nothing here creates float or touches safeguarding.

CREATE TABLE IF NOT EXISTS split_settlements (
    id                     UUID PRIMARY KEY,
    version                BIGINT,
    creditor_id            UUID           NOT NULL,
    debtor_id              UUID           NOT NULL,
    amount                 NUMERIC(15, 2) NOT NULL,
    currency               VARCHAR(3)     NOT NULL DEFAULT 'GHS',
    request_transaction_id UUID,
    status                 VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    created_at             TIMESTAMP,
    settled_at             TIMESTAMP,

    -- Zero is legitimate: debts that cancel exactly settle without anyone paying anything.
    CONSTRAINT split_settlements_amount_sane CHECK (amount >= 0),
    CONSTRAINT split_settlements_not_self CHECK (creditor_id <> debtor_id)
);

CREATE INDEX IF NOT EXISTS idx_split_settlements_creditor ON split_settlements (creditor_id);
CREATE INDEX IF NOT EXISTS idx_split_settlements_debtor ON split_settlements (debtor_id);

-- A share consolidated into a settlement. NETTED means outstanding-but-collapsed, never
-- forgiven: the share becomes PAID only when the settlement covering it is.
ALTER TABLE expense_split_participants
    ADD COLUMN IF NOT EXISTS settlement_id UUID;

CREATE INDEX IF NOT EXISTS idx_expense_split_participants_settlement
    ON expense_split_participants (settlement_id);

-- Marks the single netted request, so accepting it settles every share behind it.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS settlement_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_settlement ON transactions (settlement_id);
