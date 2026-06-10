-- ─── Device list: last-active + location ──────────────────────────────────────
-- Adds two columns to refresh_tokens powering the Security & Privacy devices list:
--   last_used_at — bumped on every login/token-refresh (Hibernate @UpdateTimestamp)
--   location     — best-effort "City, Country" resolved from the session IP
-- Schema is normally applied by Hibernate ddl-auto=update; this file documents the
-- change for production DBs that apply migrations manually.

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS location     VARCHAR(255);

-- Backfill last_used_at so existing sessions don't show as "never active".
UPDATE refresh_tokens SET last_used_at = created_at WHERE last_used_at IS NULL;
