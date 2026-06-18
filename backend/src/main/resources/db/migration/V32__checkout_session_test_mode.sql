-- Sandbox: checkout sessions created with an aza_test_ API key are flagged test_mode.
-- Test sessions complete without moving real funds and never affect merchant balances,
-- settlements, or reporting. Existing rows are live (false).
ALTER TABLE checkout_sessions
    ADD COLUMN test_mode BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_checkout_sessions_merchant_test_mode
    ON checkout_sessions (merchant_id, test_mode);
