-- Richer agent applications: capture what the back office needs to make an
-- informed approval decision, instead of just a free-text location. All optional
-- so existing PENDING applications remain valid.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_name               VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS contact_phone               VARCHAR(32);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS id_number                   VARCHAR(64);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS expected_monthly_volume_ghs NUMERIC(15, 2);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS application_notes           TEXT;
