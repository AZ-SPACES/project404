-- Enforce one redemption per (promo code, user) at the database level.
-- This is a hard constraint that survives any application-layer race condition.
ALTER TABLE promo_code_redemptions
    ADD CONSTRAINT uq_promo_redemption_user
    UNIQUE (promo_code_id, user_id);
