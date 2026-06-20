-- V34: Drop the stale CHECK constraint on pending_approvals.action_type.
--
-- Hibernate (ddl-auto) and the V25.5 backfill both generated a CHECK constraint that
-- enumerates the ActionType values known at the time. Adding a new constant
-- (APPROVE_WITHDRAWAL — withdrawal approval now goes through maker-checker) is rejected
-- by that stale constraint, so an INSERT fails with a 409/constraint violation.
--
-- Authorization for the value set is enforced in the application (ActionType.valueOf +
-- the requiredRole switch), so the DB CHECK adds no safety — drop any such constraint so
-- current and future enum values are accepted. Same pattern as V31 for kyb_documents.type.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'pending_approvals'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%action_type%'
    LOOP
        EXECUTE format('ALTER TABLE pending_approvals DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
