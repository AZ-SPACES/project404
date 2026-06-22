-- Separate agent operating float from personal funds. Wallets become typed: every
-- user has one PERSONAL wallet; an agent additionally holds one AGENT_FLOAT wallet
-- that backs cash-in/out. This ring-fences customer-backed float from the agent's own
-- spending money and lets safeguarding report agent float distinctly.

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'PERSONAL';

-- One wallet per user becomes one wallet per (user, type).
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_key;
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
