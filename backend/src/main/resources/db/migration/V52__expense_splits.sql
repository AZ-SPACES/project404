-- Bill splitting — a bill one person already paid, and who owes them a share of it.
--
-- No money is escrowed and none moves when a split is created. Each share is an ordinary
-- payment_request the participant approves through the existing path, so splitting a bill
-- is never a second way to move money. That is also why nothing here appears in the
-- safeguarding snapshot: a split is a ledger of intent over transfers that either happen
-- or don't.

CREATE TABLE IF NOT EXISTS expense_splits (
    id              UUID PRIMARY KEY,
    version         BIGINT,
    creator_id      UUID           NOT NULL,
    idempotency_key VARCHAR(100)   NOT NULL,
    total_amount    NUMERIC(15, 2) NOT NULL,
    currency        VARCHAR(3)     NOT NULL DEFAULT 'GHS',
    description     VARCHAR(140)   NOT NULL,
    split_mode      VARCHAR(16)    NOT NULL DEFAULT 'EQUAL',
    status          VARCHAR(16)    NOT NULL DEFAULT 'OPEN',
    created_at      TIMESTAMP,
    settled_at      TIMESTAMP,
    cancelled_at    TIMESTAMP,

    CONSTRAINT expense_splits_total_positive CHECK (total_amount > 0),
    -- Retrying a create must find the split it already made rather than asking
    -- everyone for their share twice.
    CONSTRAINT uk_expense_splits_creator_idem UNIQUE (creator_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_creator ON expense_splits (creator_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_status ON expense_splits (status);

CREATE TABLE IF NOT EXISTS expense_split_participants (
    id                 UUID PRIMARY KEY,
    split_id           UUID           NOT NULL REFERENCES expense_splits (id),
    user_id            UUID           NOT NULL,
    amount_owed        NUMERIC(15, 2) NOT NULL,
    organiser          BOOLEAN        NOT NULL DEFAULT FALSE,
    status             VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    request_transaction_id UUID,
    settled_at         TIMESTAMP,
    created_at         TIMESTAMP,

    -- Nobody is on the same bill twice; a duplicate would double what they owe.
    CONSTRAINT uk_expense_split_participants_split_user UNIQUE (split_id, user_id),
    -- The organiser's share may be zero when the named shares cover the whole bill;
    -- anyone who is actually being asked must owe something.
    CONSTRAINT expense_split_participants_amount_sane
        CHECK (amount_owed >= 0 AND (organiser OR amount_owed > 0))
);

CREATE INDEX IF NOT EXISTS idx_expense_split_participants_split
    ON expense_split_participants (split_id);
CREATE INDEX IF NOT EXISTS idx_expense_split_participants_user
    ON expense_split_participants (user_id);

-- Marks a money request as one person's share of a split, so accepting or declining it
-- rolls the split forward. Null for every ordinary transaction.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS split_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_split ON transactions (split_id);
