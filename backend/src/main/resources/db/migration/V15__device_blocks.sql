-- Device block registry: platform-wide device bans by client-generated deviceId.
-- Blocking kills all live sessions and prevents future logins from the device.
CREATE TABLE IF NOT EXISTS device_blocks (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           VARCHAR(255) NOT NULL UNIQUE,
    device_name         VARCHAR(255),
    device_os           VARCHAR(50),
    associated_user_id  UUID,
    reason              VARCHAR(500),
    blocked_by_email    VARCHAR(255) NOT NULL,
    blocked_at          TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_blocks_device_id ON device_blocks(device_id);

-- regulatory_filings: tracks when each BoG/STR/journal filing has been completed.
CREATE TABLE IF NOT EXISTS regulatory_filings (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(30)  NOT NULL,
    period          VARCHAR(20)  NOT NULL,
    notes           VARCHAR(500),
    filed_by_email  VARCHAR(255) NOT NULL,
    filed_at        TIMESTAMP    NOT NULL DEFAULT now()
);
