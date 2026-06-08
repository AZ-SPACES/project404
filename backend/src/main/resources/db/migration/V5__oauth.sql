-- OAuth 2.0 client registry and access token store for "Sign in with AZA"

CREATE TABLE IF NOT EXISTS oauth_clients (
    id                  UUID PRIMARY KEY,
    client_id           VARCHAR(64)  NOT NULL UNIQUE,
    client_secret_hash  VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,
    app_description     TEXT,
    logo_url            VARCHAR(500),
    website_url         VARCHAR(500),
    redirect_uris       TEXT         NOT NULL, -- comma-separated
    allowed_scopes      TEXT         NOT NULL, -- comma-separated: identity,email,phone,wallet:read
    owner_id            UUID         NOT NULL REFERENCES users(id),
    active              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_owner ON oauth_clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id                  UUID PRIMARY KEY,
    client_id           UUID         NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id             UUID         NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    token_hash          VARCHAR(255) NOT NULL UNIQUE,
    scopes              TEXT         NOT NULL, -- comma-separated
    expires_at          TIMESTAMP    NOT NULL,
    refresh_token_hash  VARCHAR(255) UNIQUE,
    refresh_expires_at  TIMESTAMP,
    revoked             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_user   ON oauth_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client ON oauth_access_tokens(client_id);
