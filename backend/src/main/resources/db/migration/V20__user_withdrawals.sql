CREATE TABLE IF NOT EXISTS user_withdrawals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    amount      NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    currency    VARCHAR(10)  NOT NULL DEFAULT 'GHS',
    provider    VARCHAR(50)  NOT NULL,
    destination VARCHAR(100) NOT NULL,
    bank_name   VARCHAR(100),
    status      VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    admin_note  TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_withdrawals_user ON user_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_withdrawals_status ON user_withdrawals(status);
