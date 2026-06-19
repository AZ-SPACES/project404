-- Enforce one redemption per (promo code, user) at the database level.
-- This is a hard constraint that survives any application-layer race condition.
-- Wrapped in a guard so replaying this migration on a DB that already has the
-- constraint (baseline replay against the Hibernate-built prod schema) is a no-op.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_promo_redemption_user'
          AND conrelid = 'promo_code_redemptions'::regclass
    ) THEN
        ALTER TABLE promo_code_redemptions
            ADD CONSTRAINT uq_promo_redemption_user
            UNIQUE (promo_code_id, user_id);
    END IF;
END $$;
