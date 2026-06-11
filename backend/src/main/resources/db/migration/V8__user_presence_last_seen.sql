-- ─── Presence: persisted "last seen" ──────────────────────────────────────────
-- Adds users.last_seen_at, written on online→offline transitions (clean WS
-- disconnects and the stale-presence sweeper). Live values during a session
-- come from Redis (presence:lastseen:{userId}); this column is the durable
-- fallback powering "last seen" in chat and the admin user views.
-- Schema is normally applied by Hibernate ddl-auto=update; this file documents
-- the change for production DBs that apply migrations manually.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

-- Backfill from the last login so existing users don't show "never seen".
UPDATE users SET last_seen_at = last_login_at WHERE last_seen_at IS NULL;
