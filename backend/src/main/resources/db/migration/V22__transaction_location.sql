-- Attach city-level GPS location to each transaction for fraud/AML signals.
-- Populated only when the initiating device sends location consent.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS initiation_location VARCHAR(255);
