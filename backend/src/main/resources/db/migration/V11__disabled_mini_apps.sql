-- ─── Mini app kill switch ──────────────────────────────────────────────────────
-- Admins can disable a mini app platform-wide (usually while resolving a user
-- report). The mobile hub fetches the disabled list and hides/blocks those apps.
-- Schema is normally applied by Hibernate ddl-auto=update; this file documents
-- the change for production DBs that apply migrations manually.

CREATE TABLE IF NOT EXISTS disabled_mini_apps (
    app_id      VARCHAR(100) PRIMARY KEY,
    reason      TEXT,
    disabled_by UUID NOT NULL,
    disabled_at TIMESTAMP
);
