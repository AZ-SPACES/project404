-- Offline scan-to-pay hardening.
--
-- transactions.recipient_id has always pointed at either a user or a merchant with
-- nothing recording which, so anything joining it to users silently lost every store
-- sale. Name the target explicitly, backfill from the merchants table, and while we
-- are here give merchant sales their own transaction type and a till identifier.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(16),
    ADD COLUMN IF NOT EXISTS terminal_id    VARCHAR(40);

ALTER TABLE checkout_sessions
    ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(40);

-- Backfill: a recipient_id present in merchants is a store payment, everything else
-- is a person. User and merchant ids are both random UUIDs, so no row matches both.
UPDATE transactions t
SET recipient_type = 'MERCHANT'
WHERE recipient_type IS NULL
  AND EXISTS (SELECT 1 FROM merchants m WHERE m.id = t.recipient_id);

UPDATE transactions
SET recipient_type = 'USER'
WHERE recipient_type IS NULL;

ALTER TABLE transactions
    ALTER COLUMN recipient_type SET DEFAULT 'USER',
    ALTER COLUMN recipient_type SET NOT NULL;

-- Widen the type check before retyping anything through it.
--
-- transactions.type carries a CHECK listing the values that existed when the column was
-- created. MERCHANT_PAYMENT came later, so the retype below fails against it on any
-- database holding real store sales — and passes on an empty one, which is how this got
-- as far as it did. Recreated from the current TransactionType enum, which also admits
-- BILL_PAY and the disbursement types that had the same latent problem waiting.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('TRANSFER', 'REQUEST', 'CASH_IN', 'CASH_OUT',
                    'MERCHANT_PAYMENT', 'BILL_PAY', 'PAYOUT', 'DISBURSEMENT'));

-- Retype completed store sales that were written as plain TRANSFERs, so statements
-- and the P2P-vs-merchant volume split stop counting purchases as transfers.
UPDATE transactions
SET type = 'MERCHANT_PAYMENT'
WHERE recipient_type = 'MERCHANT'
  AND type = 'TRANSFER';

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_type
    ON transactions (recipient_type, recipient_id);

-- Report, do not repair, handles claimed in both namespaces before HandleRegistry
-- existed. Renaming one side would silently break whichever posters or shared links
-- already carry it, so this surfaces the list for a human to settle with the owners.
-- New collisions are refused at signup, profile edit, and merchant registration.
DO $$
DECLARE
    collisions TEXT;
    collision_count INT;
BEGIN
    SELECT count(*), string_agg(m.business_handle, ', ' ORDER BY m.business_handle)
      INTO collision_count, collisions
      FROM merchants m
      JOIN users u ON lower(u.username) = lower(m.business_handle)
     WHERE u.id <> m.user_id;

    IF collision_count > 0 THEN
        RAISE WARNING
            'Handle collision: % business handle(s) also exist as usernames belonging to someone else (%). Scanned store payments are unaffected — the app now sends an explicit merchant recipient type — but a payer typing the handle by hand reaches the person, not the shop.',
            collision_count, collisions;
    END IF;
END $$;
