-- Workstream G: BoG-style KYC tiers. New users start at TIER_1 (minimum KYC).
-- Existing verified users are placed at TIER_3 so their current limits are not
-- suddenly tightened; real tier assignment should follow each user's actual KYC
-- level over time.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS kyc_tier VARCHAR(20) NOT NULL DEFAULT 'TIER_1';

UPDATE users SET kyc_tier = 'TIER_3' WHERE kyc_status = 'VERIFIED';
