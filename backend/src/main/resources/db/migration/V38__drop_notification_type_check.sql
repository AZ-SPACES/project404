-- Drop the stale CHECK constraint on notifications.type.
--
-- On DBs built by the legacy ddl-auto=update, Hibernate generated a CHECK constraint
-- enumerating the NotificationType values known at the time. Adding new constants
-- (AGENT_APPROVED / AGENT_REJECTED / AGENT_SUSPENDED for agent status changes) is
-- rejected by that stale constraint, so the notification INSERT fails. The value set is
-- enforced in the application by the enum, so the DB CHECK adds no safety. Same dynamic
-- pattern as V31 (kyb_documents.type) and V34 (pending_approvals.action_type).
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'notifications'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
