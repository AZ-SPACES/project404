-- ─── Mini app status ───────────────────────────────────────────────────────────
-- Extends the kill switch into a status system: DISABLED (hidden from the hub)
-- or MAINTENANCE (shown greyed-out with a user-facing notice). Existing rows
-- were all kill-switch disables, so they default to DISABLED.
-- Schema is normally applied by Hibernate ddl-auto=update; this file documents
-- the change for production DBs that apply migrations manually.

ALTER TABLE disabled_mini_apps
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'DISABLED';
