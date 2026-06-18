-- Hibernate (ddl-auto=update) auto-generated a CHECK constraint on kyb_documents.type
-- enumerating the KybDocument.DocumentType values that existed when the table was first
-- created. Adding a new enum constant (e.g. PROOF_OF_ADDRESS) does NOT update that stale
-- CHECK constraint, so inserting a row with a newly added type fails with a
-- DataIntegrityViolationException, surfaced to clients as 409 Conflict.
--
-- The V1 baseline intentionally has no CHECK constraint on this column and relies on
-- application-level enum validation (DocumentType.valueOf). Drop any stale CHECK
-- constraint(s) on the type column so the live DB matches the baseline and accepts all
-- current and future enum values.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'kyb_documents'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE kyb_documents DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
