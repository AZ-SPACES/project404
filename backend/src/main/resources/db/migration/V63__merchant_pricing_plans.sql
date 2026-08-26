-- Merchant MDR joins the fee engine.
--
-- V23 said merchant pricing kept its own per-merchant integer "for now". The cost of that
-- was everything the engine already gives consumer fees and merchant fees went without:
-- no rule versioning, no effective_from/to dating, no amount bands, no min/max caps, and
-- no way to answer "what rate was this merchant on in March" from the pricing model.
--
-- The engine resolved rules on transaction_type alone, which has no room for *who* is
-- being charged. This adds that dimension as a pricing plan, so one MERCHANT_MDR rule can
-- price a whole class of merchants and be versioned like any other rule.
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
-- can back-stop plans that have no rule of their own.
ALTER TABLE fee_rules
    ADD COLUMN IF NOT EXISTS pricing_plan VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_fee_rules_type_plan
    ON fee_rules (transaction_type, pricing_plan) WHERE active = TRUE;

-- fee_rate_bps goes back to being nullable, because its meaning has changed: it is no
-- longer "this merchant's rate" (every row had one, so the engine would never be reached)
-- but "this merchant is an exception to their plan". V62 made it NOT NULL to stop a null
-- reaching the money path and throwing on unboxing; that protection now lives in
-- MerchantFeeCalculator, which resolves override -> plan rule -> default and never
-- unboxes a null.
ALTER TABLE merchants
    ALTER COLUMN fee_rate_bps DROP NOT NULL;

ALTER TABLE merchants
    ALTER COLUMN fee_rate_bps DROP DEFAULT;

-- Merchants sitting on exactly the standard rate were never negotiated there -- that is
-- just the default they were created with. They move onto the plan, so a future change to
-- standard pricing reaches them. Anything on a different rate WAS a deliberate exception
-- and keeps it, to the basis point.
UPDATE merchants
   SET fee_rate_bps = NULL
 WHERE fee_rate_bps = 150;

-- The standard plan's rule, seeded to 1.5% so that every merchant prices exactly as it did
-- before this migration ran. No caps and no bands: this reproduces today's behaviour
-- rather than inventing commercial terms. Finance adds bands, caps and further plans
-- through the admin API, where each change is versioned and needs a second approver.
INSERT INTO fee_rules (id, name, description, transaction_type, pricing_plan, fee_type,
                       amount, min_fee, max_fee, active, effective_from)
SELECT 'a1f1e2d3-0003-4a03-9003-000000000003', 'Merchant MDR — standard',
       'Standard merchant discount rate: 1.5% of the sale',
       'MERCHANT_MDR', 'STANDARD', 'PERCENTAGE', 1.5, NULL, NULL, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM fee_rules WHERE transaction_type = 'MERCHANT_MDR' AND pricing_plan = 'STANDARD'
);
