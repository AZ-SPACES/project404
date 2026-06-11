-- ─── Chat history sync ────────────────────────────────────────────────────────
-- Two E2EE-preserving ways to get message history onto a new device:
--   1. history_transfers: device-to-device transfer at link time. The old
--      device re-encrypts its local decrypted cache to the new device's
--      identity key and ships it through the server as opaque chunks.
--   2. chat_backups: client-side-encrypted backup blobs keyed by a recovery
--      key only the user holds.
-- The server never sees plaintext in either path — payloads are opaque base64.

-- 1. Device-to-device history transfers ----------------------------------------
CREATE TABLE IF NOT EXISTS history_transfers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    requesting_device_id VARCHAR(255) NOT NULL,
    source_device_id     VARCHAR(255),
    status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    chunk_count          INT,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW(),
    expires_at           TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_transfers_user_id
    ON history_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_history_transfers_expires_at
    ON history_transfers(expires_at);

CREATE TABLE IF NOT EXISTS history_transfer_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL,
    seq         INT NOT NULL,
    payload     TEXT NOT NULL,
    CONSTRAINT fk_history_transfer_chunks_transfer
        FOREIGN KEY (transfer_id) REFERENCES history_transfers(id) ON DELETE CASCADE,
    CONSTRAINT uk_history_transfer_chunk UNIQUE (transfer_id, seq)
);

-- 2. Encrypted chat backups -----------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_backups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'UPLOADING',
    chunk_count INT NOT NULL DEFAULT 0,
    size_bytes  BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_backups_user_id
    ON chat_backups(user_id);

CREATE TABLE IF NOT EXISTS chat_backup_chunks (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID NOT NULL,
    seq       INT NOT NULL,
    payload   TEXT NOT NULL,
    CONSTRAINT fk_chat_backup_chunks_backup
        FOREIGN KEY (backup_id) REFERENCES chat_backups(id) ON DELETE CASCADE,
    CONSTRAINT uk_chat_backup_chunk UNIQUE (backup_id, seq)
);
