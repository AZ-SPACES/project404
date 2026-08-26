-- fee_rate_bps was nullable with no database default. The 1.5% fallback lived only in the
-- Java entity's @Builder.Default, which applies to the builder and nothing else -- so any
-- row inserted by hand, by a data fix, or by an older version could carry NULL. Every
-- money path then did BigDecimal.valueOf(merchant.getFeeRateBps()), which unboxes an
-- Integer and throws NullPointerException in the middle of taking a payment.
--
-- Rates stay per-merchant. This backfills ONLY the rows that have no rate at all; every
-- merchant already on a negotiated, promotional or otherwise distinct rate keeps it
-- untouched. The default is a floor for rows that would otherwise be null, not a policy
-- that all merchants pay the same.
UPDATE merchants
   SET fee_rate_bps = 150
 WHERE fee_rate_bps IS NULL;

ALTER TABLE merchants
    ALTER COLUMN fee_rate_bps SET DEFAULT 150;

ALTER TABLE merchants
    ALTER COLUMN fee_rate_bps SET NOT NULL;

-- A rate outside 0..10000 bps is not a rate. The service validates this on the way in;
-- the constraint means a direct SQL fix cannot quietly install a 300% MDR either.
ALTER TABLE merchants
    ADD CONSTRAINT merchants_fee_rate_bps_range CHECK (fee_rate_bps BETWEEN 0 AND 10000);
