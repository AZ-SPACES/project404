-- Bill payments — utilities, airtime, government fees.
--
-- The first money path where funds leave Aza entirely and the outcome is decided by a
-- system Aza does not control. The wallet is debited and committed before the provider is
-- ever called, so PENDING means "debited, outcome unknown" — customer money that has left
-- a wallet and reached nobody Aza can name. ReconciliationService counts it in the
-- safeguarding snapshot for the same reason it counts payment_holds and unopened Akyede.

CREATE TABLE IF NOT EXISTS billers (
    id                   UUID PRIMARY KEY,
    slug                 VARCHAR(60)    NOT NULL UNIQUE,
    name                 VARCHAR(120)   NOT NULL,
    category             VARCHAR(24)    NOT NULL,
    logo_url             VARCHAR(500),
    account_label        VARCHAR(60)    NOT NULL,
    account_pattern      VARCHAR(200),
    min_amount           NUMERIC(15, 2) NOT NULL DEFAULT 1.00,
    max_amount           NUMERIC(15, 2),
    supports_name_lookup BOOLEAN        NOT NULL DEFAULT FALSE,
    provider_code        VARCHAR(60),
    active               BOOLEAN        NOT NULL DEFAULT TRUE,

    CONSTRAINT billers_amounts_sane
        CHECK (min_amount > 0 AND (max_amount IS NULL OR max_amount >= min_amount))
);

CREATE INDEX IF NOT EXISTS idx_billers_category ON billers (category);
CREATE INDEX IF NOT EXISTS idx_billers_active ON billers (active);

CREATE TABLE IF NOT EXISTS bill_payments (
    id                  UUID PRIMARY KEY,
    version             BIGINT,
    user_id             UUID           NOT NULL,
    biller_id           UUID           NOT NULL REFERENCES billers (id),
    account_number      VARCHAR(120)   NOT NULL,
    account_name        VARCHAR(160),
    amount              NUMERIC(15, 2) NOT NULL,
    currency            VARCHAR(3)     NOT NULL DEFAULT 'GHS',
    status              VARCHAR(16)    NOT NULL DEFAULT 'PENDING',
    transaction_id      UUID,
    provider_reference  VARCHAR(120),
    token               VARCHAR(200),
    failure_reason      VARCHAR(500),
    idempotency_key     VARCHAR(100)   NOT NULL,
    created_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    refunded_at         TIMESTAMP,
    reconcile_attempts  INTEGER        NOT NULL DEFAULT 0,

    CONSTRAINT bill_payments_amount_positive CHECK (amount > 0),
    -- Scoped to the user: a globally unique key would let one customer's retry surface
    -- another customer's payment.
    CONSTRAINT uk_bill_payments_user_idem UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON bill_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_status ON bill_payments (status);

-- The catalogue Aza starts with. provider_code is deliberately null on every row: no
-- aggregator is wired yet, and a code invented here would be a code that silently fails
-- to match whoever is chosen. Amounts are the billers' own published floors.
INSERT INTO billers (id, slug, name, category, account_label, account_pattern,
                     min_amount, max_amount, supports_name_lookup, active)
VALUES
    (gen_random_uuid(), 'ecg-prepaid', 'ECG Prepaid', 'ELECTRICITY', 'Meter number',
     '^[0-9]{8,14}$', 5.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'ecg-postpaid', 'ECG Postpaid', 'ELECTRICITY', 'Account number',
     '^[0-9]{8,14}$', 5.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'nedco', 'NEDCo', 'ELECTRICITY', 'Meter number',
     '^[0-9]{8,14}$', 5.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'ghana-water', 'Ghana Water', 'WATER', 'Account number',
     '^[0-9]{6,14}$', 5.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'mtn-airtime', 'MTN Airtime', 'AIRTIME', 'Phone number',
     '^0[235][0-9]{8}$', 1.00, 1000.00, FALSE, TRUE),
    (gen_random_uuid(), 'telecel-airtime', 'Telecel Airtime', 'AIRTIME', 'Phone number',
     '^0[235][0-9]{8}$', 1.00, 1000.00, FALSE, TRUE),
    (gen_random_uuid(), 'at-airtime', 'AT Airtime', 'AIRTIME', 'Phone number',
     '^0[235][0-9]{8}$', 1.00, 1000.00, FALSE, TRUE),
    (gen_random_uuid(), 'mtn-data', 'MTN Data', 'DATA', 'Phone number',
     '^0[235][0-9]{8}$', 1.00, 1000.00, FALSE, TRUE),
    (gen_random_uuid(), 'dstv', 'DStv', 'TV', 'Smartcard number',
     '^[0-9]{8,12}$', 20.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'gotv', 'GOtv', 'TV', 'IUC number',
     '^[0-9]{8,12}$', 20.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'startimes', 'StarTimes', 'TV', 'Smartcard number',
     '^[0-9]{8,12}$', 20.00, 5000.00, TRUE, TRUE),
    (gen_random_uuid(), 'dvla', 'DVLA', 'GOVERNMENT', 'Reference number',
     '^[A-Za-z0-9-]{5,20}$', 10.00, 20000.00, FALSE, TRUE),
    (gen_random_uuid(), 'gra-tax', 'Ghana Revenue Authority', 'GOVERNMENT', 'TIN',
     '^[A-Za-z0-9]{8,15}$', 10.00, 100000.00, FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;
