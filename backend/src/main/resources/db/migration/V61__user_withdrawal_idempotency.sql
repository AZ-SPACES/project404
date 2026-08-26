-- Requesting a withdrawal reserves the funds immediately -- it debits the wallet. It was
-- the one consumer money endpoint with no idempotency key, so a double-submitted request
-- (a retry, a double tap, a flaky connection) debited twice and left two PENDING rows.
--
-- Scoped per user, not globally. A global unique key lets one account's retry collide with
-- another's and hand back somebody else's withdrawal -- the cross-tenant leak that
-- V43 fixed for checkout sessions. The same rule applies here.
ALTER TABLE user_withdrawals
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS user_withdrawals_user_idempotency_key
    ON user_withdrawals (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
