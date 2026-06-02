-- V3: Support 30-day account deletion grace period.
-- Adds scheduled_deletion_at to track when erasure should run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_scheduled_deletion ON users (scheduled_deletion_at)
    WHERE scheduled_deletion_at IS NOT NULL;
