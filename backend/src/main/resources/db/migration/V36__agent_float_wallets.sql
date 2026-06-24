-- Separate agent operating float from personal funds. Wallets become typed: every
-- user has one PERSONAL wallet; an agent additionally holds one AGENT_FLOAT wallet
-- that backs cash-in/out. This ring-fences customer-backed float from the agent's own
-- spending money and lets safeguarding report agent float distinctly.

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'PERSONAL';

-- One wallet per user becomes one wallet per (user, type). The old unique was created
-- either by the V1 baseline (named wallets_user_id_key) or, on DBs built by the legacy
-- ddl-auto=update, by Hibernate (an opaque uk_* name). Drop ANY unique constraint that
-- is exactly on (user_id) so a second AGENT_FLOAT wallet can be inserted. Same dynamic
-- pattern as V31/V34.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'wallets'
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) = 'UNIQUE (user_id)'
    LOOP
        EXECUTE format('ALTER TABLE wallets DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_type_key;
ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_type_key UNIQUE (user_id, type);

-- Backfill: existing ACTIVE agents get a zero-balance float wallet. Fresh float is
-- minted by finance afterwards; existing personal balances are deliberately left
-- untouched so no personal money is reclassified as operational float.
INSERT INTO wallets (id, user_id, type, balance, currency, frozen, last_updated_at)
SELECT gen_random_uuid(), a.user_id, 'AGENT_FLOAT', 0, 'GHS', false, NOW()
FROM agents a
WHERE a.status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1 FROM wallets w WHERE w.user_id = a.user_id AND w.type = 'AGENT_FLOAT'
  );
