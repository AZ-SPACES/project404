-- V29: User reports against payment handles / store codes (scam, impersonation, …).
-- Feeds the back-office screening queue. Mirrors mini_app_reports.

CREATE TABLE IF NOT EXISTS handle_reports (
    id                    UUID PRIMARY KEY,
    reported_handle       VARCHAR(100) NOT NULL,
    reported_merchant_id  UUID,
    reported_by_user_id   UUID NOT NULL,
    reported_by_handle    VARCHAR(100),
    reason                VARCHAR(30) NOT NULL,
    details               TEXT,
    status                VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    resolved_by           UUID,
    resolved_at           TIMESTAMP,
    resolution            TEXT,
    created_at            TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handle_reports_status ON handle_reports (status);
CREATE INDEX IF NOT EXISTS idx_handle_reports_handle ON handle_reports (reported_handle);
