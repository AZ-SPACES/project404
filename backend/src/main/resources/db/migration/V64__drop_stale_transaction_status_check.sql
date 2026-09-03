-- Drop the stale CHECK constraint on transactions.status.
--
-- On DBs adopted from the legacy ddl-auto=update, Hibernate generated a CHECK constraint
-- enumerating the TransactionStatus values known at the time. HELD_FOR_REVIEW was added
-- later for the fraud-detection hold, so on those databases the UPDATE that holds a
-- transfer is rejected outright — and because the flush lands inside the risk engine's
-- catch block, the failure surfaces two statements later as "current transaction is
-- aborted" on an unrelated notifications INSERT. The user sees a raw Postgres error on
-- the PIN screen and the transfer is neither sent nor held.
--
-- The value set is enforced in the application by the enum, so the DB CHECK adds no
-- safety. Same dynamic pattern as V31 (kyb_documents.type), V34 (pending_approvals
-- .action_type) and V38 (notifications.type).
--
-- Matched on conkey rather than the constraint text so only single-column CHECKs on
-- `status` are touched — transactions also carries type and recipient_type constraints
-- that a text match would sweep up.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attname = 'status'
        WHERE rel.relname = 'transactions'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
          AND con.conkey = ARRAY[att.attnum]
    LOOP
        EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
