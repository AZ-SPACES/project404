-- ─── Mini App Platform (WeChat-style) ──────────────────────────────────────────
-- Developers submit mini apps; admins review; active apps appear in the hub.
-- Users grant per-app permissions on first launch.

CREATE TABLE IF NOT EXISTS mini_apps (
    id               VARCHAR(100) PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    category         VARCHAR(50),
    icon_url         TEXT,
    url              TEXT NOT NULL,
    developer_name   VARCHAR(255),
    support_url      TEXT,
    version          VARCHAR(20),
    status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    submitted_by     UUID NOT NULL,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    submitted_at     TIMESTAMP,
    reviewed_by      UUID,
    reviewed_at      TIMESTAMP,
    rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS mini_app_permissions (
    app_id     VARCHAR(100) NOT NULL REFERENCES mini_apps(id) ON DELETE CASCADE,
    permission VARCHAR(30)  NOT NULL,
    PRIMARY KEY (app_id, permission)
);

CREATE TABLE IF NOT EXISTS mini_app_consents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL,
    app_id     VARCHAR(100) NOT NULL REFERENCES mini_apps(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, app_id)
);

CREATE TABLE IF NOT EXISTS mini_app_consent_permissions (
    consent_id UUID        NOT NULL REFERENCES mini_app_consents(id) ON DELETE CASCADE,
    permission VARCHAR(30) NOT NULL,
    PRIMARY KEY (consent_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_mini_apps_status      ON mini_apps(status);
CREATE INDEX IF NOT EXISTS idx_mini_apps_submitted_by ON mini_apps(submitted_by);
CREATE INDEX IF NOT EXISTS idx_mini_app_consents_user ON mini_app_consents(user_id);
