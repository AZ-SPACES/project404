-- ─── Multi-device E2EE ────────────────────────────────────────────────────────
-- Moves key material off the users table (one bundle per user) onto a
-- dedicated table (one bundle per user×device). Adds a message_ciphertexts
-- table so each message can carry one encrypted envelope per recipient device.

-- 1. Device-scoped key bundles -------------------------------------------------
CREATE TABLE IF NOT EXISTS user_key_bundles (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL,
    device_id                VARCHAR(255) NOT NULL,
    identity_public_key      TEXT NOT NULL,
    signed_pre_key_public    TEXT,
    signed_pre_key_signature TEXT,
    one_time_pre_keys_json   TEXT,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_user_key_bundle UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_key_bundles_user_id ON user_key_bundles(user_id);

-- 2. Migrate existing single-bundle rows from users → user_key_bundles ---------
--    Synthetic device_id 'device_legacy' preserves data for existing accounts.
INSERT INTO user_key_bundles (
    id, user_id, device_id,
    identity_public_key, signed_pre_key_public, signed_pre_key_signature,
    one_time_pre_keys_json, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    id,
    'device_legacy',
    identity_public_key,
    signed_pre_key_public,
    signed_pre_key_signature,
    one_time_pre_keys_json,
    COALESCE(updated_at, NOW()),
    NOW()
FROM users
WHERE identity_public_key IS NOT NULL
ON CONFLICT (user_id, device_id) DO NOTHING;

-- 3. Per-device message ciphertexts -------------------------------------------
--    Each send now stores one ciphertext row per recipient (and sender) device.
CREATE TABLE IF NOT EXISTS message_ciphertexts (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id                 UUID NOT NULL,
    device_id                  VARCHAR(255) NOT NULL,
    ciphertext                 TEXT NOT NULL,
    ephemeral_key              TEXT,
    pre_key_id                 VARCHAR(255),
    sender_identity_public_key TEXT,
    CONSTRAINT fk_msg_ciphertexts_message
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_ciphertexts_message_id
    ON message_ciphertexts(message_id);

-- 4. Drop legacy E2EE columns from users --------------------------------------
ALTER TABLE users
    DROP COLUMN IF EXISTS identity_public_key,
    DROP COLUMN IF EXISTS signed_pre_key_public,
    DROP COLUMN IF EXISTS signed_pre_key_signature,
    DROP COLUMN IF EXISTS one_time_pre_keys_json;
