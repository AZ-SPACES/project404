-- Workstream A: make the fee engine computable.
-- Adds the columns the corrected fee catalog needs (combined flat+percent,
-- per-transaction and rolling-monthly free thresholds, version end date) and a
-- per-user rolling-monthly usage tally that the free-monthly tier reads.

ALTER TABLE fee_rules
    ADD COLUMN IF NOT EXISTS flat_component         NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS free_per_txn_threshold NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS free_monthly_threshold NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS effective_to           TIMESTAMP;

-- Cumulative qualifying value a user has moved this month, per transaction type.
-- The free-monthly tier is exhausted once used_amount crosses free_monthly_threshold.
CREATE TABLE IF NOT EXISTS monthly_fee_usage (
    id               UUID PRIMARY KEY,
    user_id          UUID NOT NULL,
    transaction_type VARCHAR(50)  NOT NULL,
    usage_month      VARCHAR(7)   NOT NULL,            -- 'YYYY-MM'
    used_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    updated_at       TIMESTAMP,
    CONSTRAINT uq_monthly_fee_usage UNIQUE (user_id, transaction_type, usage_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_fee_usage_lookup
    ON monthly_fee_usage (user_id, transaction_type, usage_month);

-- Seed the two consumer rules from the corrected catalog (AZA Plus excluded).
-- CASH_IN, bill pay and airtime stay free for the consumer by having no active
-- rule. Merchant MDR keeps using the per-merchant fee_rate_bps override for now.
INSERT INTO fee_rules (id, name, description, transaction_type, fee_type, amount,
                       min_fee, max_fee, free_per_txn_threshold, free_monthly_threshold,
                       active, effective_from)
SELECT 'a1f1e2d3-0001-4a01-9001-000000000001', 'P2P transfer',
       'Free everyday tier; 0.5% above the free tier, capped at GHS 10',
       'P2P', 'PERCENTAGE', 0.5, NULL, 10, 100, 1000, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM fee_rules WHERE transaction_type = 'P2P');

INSERT INTO fee_rules (id, name, description, transaction_type, fee_type, amount,
                       min_fee, max_fee, free_per_txn_threshold, free_monthly_threshold,
                       active, effective_from)
SELECT 'a1f1e2d3-0002-4a02-9002-000000000002', 'Cash-out',
       'Cash withdrawal at an agent: 1%, min GHS 0.50, capped at GHS 15',
       'CASH_OUT', 'PERCENTAGE', 1.0, 0.50, 15, NULL, NULL, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM fee_rules WHERE transaction_type = 'CASH_OUT');
