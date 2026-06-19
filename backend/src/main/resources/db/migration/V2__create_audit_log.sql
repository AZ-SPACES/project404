-- V2: Financial and auth audit log table.
-- Tracks security-sensitive events for regulatory compliance (BoG, GDPR).

CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY,
    user_id       UUID,
    user_email    VARCHAR(255),
    event_type    VARCHAR(100) NOT NULL,
    outcome       VARCHAR(10)  NOT NULL,  -- 'SUCCESS' | 'FAILURE'
    ip_address    VARCHAR(45),
    device_id     VARCHAR(255),
    resource_id   UUID,
    resource_type VARCHAR(50),
    details       TEXT,
    created_at    TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);
