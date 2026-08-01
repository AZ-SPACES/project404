-- Scope checkout-session idempotency keys per merchant.
--
-- The old schema had a GLOBAL unique constraint on checkout_sessions.idempotency_key,
-- paired (in code) with an unscoped lookup: merchant B reusing a key merchant A had
-- already used was handed A's session (id, amount, description, checkout URL) — a
-- cross-tenant disclosure. The code now looks up by (merchant_id, idempotency_key);
-- this migration makes the constraint match, following the connect_transfers pattern
-- (V41: connect_transfers_merchant_idem_key).
--
-- No duplicate pre-check is needed: the old constraint was unique on (idempotency_key)
-- alone, which strictly implies uniqueness on (merchant_id, idempotency_key). The new
-- constraint is weaker, so it cannot fail on existing data.
--
-- The old constraint's name varies by environment (production predates Flyway and was
-- built by ddl-auto=update, so Hibernate generated a uk_* name; other environments may
-- have the PostgreSQL default checkout_sessions_idempotency_key_key). Drop whatever
-- single-column unique constraint or index exists on idempotency_key by catalog lookup.

DO $$
DECLARE
    con RECORD;
BEGIN
    -- Unique constraints on exactly (idempotency_key)
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'checkout_sessions'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = c.conkey[1]
                AND a.attname = 'idempotency_key'
          )
    LOOP
        EXECUTE format('ALTER TABLE checkout_sessions DROP CONSTRAINT %I', con.conname);
    END LOOP;

    -- Standalone single-column unique indexes on idempotency_key (not constraint-backed)
    FOR con IN
        SELECT i.indexrelid::regclass::text AS idxname
        FROM pg_index i
        WHERE i.indrelid = 'checkout_sessions'::regclass
          AND i.indisunique
          AND i.indnatts = 1
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
          AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = i.indrelid
                AND a.attnum = i.indkey[0]
                AND a.attname = 'idempotency_key'
          )
    LOOP
        EXECUTE format('DROP INDEX %I', con.idxname);
    END LOOP;
END $$;

ALTER TABLE checkout_sessions
    ADD CONSTRAINT checkout_sessions_merchant_idem UNIQUE (merchant_id, idempotency_key);
