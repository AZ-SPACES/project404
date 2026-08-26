-- Merchant MDR joins the fee engine.
--
-- V23 said merchant pricing kept its own per-merchant integer "for now". The cost of that
-- was everything the engine already gave consumer fees and merchant fees went without: no
-- rule versioning, no effective_from/to dating, no amount bands, no min/max caps, and no
-- way to answer "what rate was this merchant on in March" from the pricing model.
--
-- The engine resolved rules on transaction_type alone, which has no room for *who* is being
-- charged. This adds that dimension as a pricing plan, so one MERCHANT_MDR rule can price a
-- whole class of merchants and be versioned like any other rule.
--
-- Rates stay different. Three things make that so:
--   1. A plan is per-merchant, so merchants on different plans price differently.
--   2. Plan rules carry tier bands, so one plan can price a GHS 5 sale and a GHS 50,000
--      sale differently.
--   3. fee_rate_bps survives as a per-merchant override that outranks the plan entirely,
--      for a rate negotiated with one merchant and nobody else.

-- Which class of pricing a merchant sits in. Everyone starts on STANDARD; finance moves
-- merchants between plans through the admin API, under maker-checker.
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS pricing_plan VARCHAR(50) NOT NULL DEFAULT 'STANDARD';

-- Which plan a rule prices. NULL means the rule applies to any plan, so a catch-all rule
-- can back-stop plans that have no rule of their own. A rule written for a *different*
-- plan is never used as a fallback -- pricing a merchant on somebody else's negotiated
-- terms would be worse than having no rule at all.
ALTER TABLE fee_rules
    ADD COLUMN IF NOT EXISTS pricing_plan VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_fee_rules_type_plan
    ON fee_rules (transaction_type, pricing_plan) WHERE active = TRUE;

-- fee_rate_bps changes meaning: no longer "this merchant's rate" but "this merchant is an
-- exception to their plan". It stays nullable, because null is now meaningful -- it is how
-- a merchant says "price me off my plan".
--
-- Merchants sitting on exactly the standard rate were never negotiated there; that is just
-- the default they were created with. They move onto the plan, so a future change to
-- standard pricing reaches them. Anything on a different rate WAS a deliberate exception
-- and keeps it, to the basis point. Rows already null stay null and are likewise priced by
-- the plan, which is the same 1.5% they were getting from the entity default.
UPDATE merchants
   SET fee_rate_bps = NULL
 WHERE fee_rate_bps = 150;

-- A rate outside 0..10000 bps is not a rate. The service validates this on the way in; the
-- constraint means a direct SQL fix cannot quietly install a 300% MDR either. NULL passes,
-- because NULL means "no override", not "a bad rate".
ALTER TABLE merchants
    DROP CONSTRAINT IF EXISTS merchants_fee_rate_bps_range;
ALTER TABLE merchants
    ADD CONSTRAINT merchants_fee_rate_bps_range
    CHECK (fee_rate_bps IS NULL OR fee_rate_bps BETWEEN 0 AND 10000);

-- The standard plan's rule, seeded at 1.5% so every merchant prices exactly as it did
-- before this migration ran. No caps and no bands: this reproduces today's behaviour rather
-- than inventing commercial terms. Finance adds bands, caps and further plans through the
-- admin API, where each change is versioned and needs a second approver.
INSERT INTO fee_rules (id, name, description, transaction_type, pricing_plan, fee_type,
                       amount, min_fee, max_fee, active, effective_from)
SELECT 'a1f1e2d3-0003-4a03-9003-000000000003', 'Merchant MDR — standard',
       'Standard merchant discount rate: 1.5% of the sale',
       'MERCHANT_MDR', 'STANDARD', 'PERCENTAGE', 1.5, NULL, NULL, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM fee_rules WHERE transaction_type = 'MERCHANT_MDR' AND pricing_plan = 'STANDARD'
);
