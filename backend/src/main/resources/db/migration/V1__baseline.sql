-- V1: Baseline schema — all tables created by Hibernate ddl-auto=update.
-- Uses CREATE TABLE IF NOT EXISTS so this is safe on existing production databases.
-- On a fresh database, this creates the complete schema.

-- ─────────────────────── Core: users & wallets ───────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                                   UUID PRIMARY KEY,
    first_name                           VARCHAR(255),
    last_name                            VARCHAR(255),
    email                                VARCHAR(255) NOT NULL UNIQUE,
    phone_number                         VARCHAR(255) NOT NULL UNIQUE,
    balance                              NUMERIC(15, 2) DEFAULT 0,
    username                             VARCHAR(255) UNIQUE,
    role                                 VARCHAR(50),
    status                               VARCHAR(50),
    deactivation_reason                  VARCHAR(255),
    kyc_status                           VARCHAR(50),
    online_status                        VARCHAR(50),
    pronouns                             VARCHAR(255),
    date_of_birth                        DATE,
    profile_image_url                    VARCHAR(255),
    home_address                         VARCHAR(255),
    city                                 VARCHAR(255),
    nationality                          VARCHAR(255),
    other_nationality                    VARCHAR(255),
    is_tax_resident_abroad               BOOLEAN,
    tax_country                          VARCHAR(255),
    -- Entity field `isUSPerson` (no @Column) maps to `isusperson` under the
    -- physical naming strategy, so the column must match for Hibernate validate.
    isusperson                           BOOLEAN,
    employment_status                    VARCHAR(50),
    password_hash                        VARCHAR(255) NOT NULL,
    passcode_hash                        VARCHAR(255),
    biometrics_enabled                   BOOLEAN,
    two_factor_enabled                   BOOLEAN,
    two_factor_secret                    VARCHAR(255),
    sms_two_factor_enabled               BOOLEAN,
    email_two_factor_enabled             BOOLEAN,
    app_two_factor_enabled               BOOLEAN,
    passkeys_enabled                     BOOLEAN,
    default_two_factor_method            VARCHAR(50),
    force_password_reset                 BOOLEAN,
    require_selfie_verification          BOOLEAN,
    find_me_by_phone                     BOOLEAN,
    find_me_by_email                     BOOLEAN,
    find_me_by_handle                    BOOLEAN,
    sync_contacts                        BOOLEAN,
    bill_forwarding_enabled              BOOLEAN,
    notification_preferences             TEXT,
    language                             VARCHAR(255),
    theme                                VARCHAR(255),
    home_background                      VARCHAR(255),
    hub_background                       VARCHAR(255),
    silent_hours_enabled                 BOOLEAN,
    silent_hours_start                   VARCHAR(255),
    silent_hours_end                     VARCHAR(255),
    silent_hours_payment_threshold       NUMERIC(15, 2),
    identity_public_key                  TEXT,
    signed_pre_key_public                TEXT,
    signed_pre_key_signature             TEXT,
    one_time_pre_keys_json               TEXT,
    custom_daily_limit_ghs               NUMERIC(15, 2),
    custom_single_transaction_limit_ghs  NUMERIC(15, 2),
    created_at                           TIMESTAMP,
    updated_at                           TIMESTAMP,
    last_login_at                        TIMESTAMP,
    deleted_at                           TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL UNIQUE,
    balance         NUMERIC(15, 2) NOT NULL,
    currency        VARCHAR(3),
    frozen          BOOLEAN,
    last_updated_at TIMESTAMP
);

-- ─────────────────────── Auth: tokens & sessions ─────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL,
    token_hash              VARCHAR(255) NOT NULL UNIQUE,
    access_token_hash       VARCHAR(255) UNIQUE,
    expires_at              TIMESTAMP NOT NULL,
    access_token_expires_at TIMESTAMP,
    device_name             VARCHAR(255),
    device_os               VARCHAR(255),
    device_id               VARCHAR(255),
    ip_address              VARCHAR(255),
    created_at              TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biometric_tokens (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL,
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    device_name  VARCHAR(255),
    device_os    VARCHAR(255),
    device_id    VARCHAR(255),
    active       BOOLEAN,
    last_used_at TIMESTAMP,
    expires_at   TIMESTAMP NOT NULL,
    created_at   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fcm_tokens (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL,
    token        VARCHAR(255) NOT NULL UNIQUE,
    device_id    VARCHAR(255),
    device_name  VARCHAR(255),
    platform     VARCHAR(255),
    created_at   TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recovery_codes (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL,
    code_hash  VARCHAR(255) NOT NULL,
    used       BOOLEAN,
    used_at    TIMESTAMP,
    created_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS account_recovery_contacts (
    id                    UUID PRIMARY KEY,
    user_id               UUID NOT NULL,
    contact_user_id       UUID NOT NULL,
    status                VARCHAR(50) NOT NULL,
    encrypted_totp_secret VARCHAR(512),
    created_at            TIMESTAMP,
    updated_at            TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_arc_user    ON account_recovery_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_arc_contact ON account_recovery_contacts (contact_user_id);

-- ─────────────────────── Transactions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
    id               UUID PRIMARY KEY,
    sender_id        UUID NOT NULL,
    recipient_id     UUID NOT NULL,
    amount           NUMERIC(15, 2) NOT NULL,
    note             VARCHAR(500),
    type             VARCHAR(50),
    status           VARCHAR(50),
    is_request       BOOLEAN,
    idempotency_key  VARCHAR(255) UNIQUE,
    expires_at       TIMESTAMP,
    initiated_at     TIMESTAMP,
    completed_at     TIMESTAMP,
    cancelled_at     TIMESTAMP,
    requested_at     TIMESTAMP,
    accepted_at      TIMESTAMP,
    declined_at      TIMESTAMP,
    category         VARCHAR(50),
    anomaly_score    DOUBLE PRECISION,
    anomaly_risk_level VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS payment_requests (
    id           UUID PRIMARY KEY,
    version      BIGINT,
    chat_id      UUID NOT NULL,
    message_id   UUID NOT NULL,
    requester_id UUID NOT NULL,
    payer_id     UUID NOT NULL,
    amount       NUMERIC(15, 2) NOT NULL,
    currency     VARCHAR(3),
    note         VARCHAR(500),
    status       VARCHAR(50),
    transaction_id UUID,
    expires_at   TIMESTAMP,
    paid_at      TIMESTAMP,
    declined_at  TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pr_chat      ON payment_requests (chat_id);
CREATE INDEX IF NOT EXISTS idx_pr_requester ON payment_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_pr_payer     ON payment_requests (payer_id);

CREATE TABLE IF NOT EXISTS recurring_transfers (
    id                   UUID PRIMARY KEY,
    user_id              UUID NOT NULL,
    recipient_identifier VARCHAR(255) NOT NULL,
    amount               NUMERIC(18, 2) NOT NULL,
    note                 VARCHAR(255),
    frequency            VARCHAR(50) NOT NULL,
    next_run_at          TIMESTAMP NOT NULL,
    status               VARCHAR(50) NOT NULL,
    total_runs           INTEGER NOT NULL,
    successful_runs      INTEGER NOT NULL,
    last_run_at          TIMESTAMP,
    last_failure_reason  VARCHAR(255),
    idempotency_key      VARCHAR(255) UNIQUE,
    created_at           TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulk_transfers (
    id              UUID PRIMARY KEY,
    merchant_id     UUID NOT NULL,
    note            VARCHAR(255),
    total_amount    NUMERIC(15, 2) NOT NULL,
    recipient_count INTEGER NOT NULL,
    success_count   INTEGER,
    failure_count   INTEGER,
    status          VARCHAR(50),
    created_at      TIMESTAMP,
    processed_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulk_transfer_items (
    id                   UUID PRIMARY KEY,
    bulk_transfer_id     UUID NOT NULL,
    recipient_identifier VARCHAR(255) NOT NULL,
    recipient_user_id    UUID,
    amount               NUMERIC(15, 2) NOT NULL,
    note                 VARCHAR(255),
    status               VARCHAR(50),
    failure_reason       VARCHAR(255),
    processed_at         TIMESTAMP
);

-- ─────────────────────── KYC / KYB ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_records (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL UNIQUE,
    biometric_consent       BOOLEAN,
    consent_timestamp       TIMESTAMP,
    consent_ip_address      VARCHAR(255),
    funds_source            VARCHAR(255),
    other_funds_text        VARCHAR(255),
    id_type                 VARCHAR(50),
    id_number               VARCHAR(255),
    id_front_image_url      VARCHAR(255),
    id_back_image_url       VARCHAR(255),
    selfie_image_url        VARCHAR(255),
    is_pep                  BOOLEAN,
    pep_status              VARCHAR(50),
    pep_role                VARCHAR(255),
    pep_account_purpose     VARCHAR(255),
    pep_monthly_volume      VARCHAR(255),
    pep_wealth_source       VARCHAR(255),
    pep_proof_doc_type      VARCHAR(255),
    pep_proof_doc_url       VARCHAR(255),
    status                  VARCHAR(50),
    rejection_reason        VARCHAR(255),
    verification_provider   VARCHAR(255),
    verification_reference  VARCHAR(255),
    created_at              TIMESTAMP,
    submitted_at            TIMESTAMP,
    verified_at             TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyb_records (
    id                   UUID PRIMARY KEY,
    merchant_id          UUID NOT NULL UNIQUE,
    registration_number  VARCHAR(255),
    business_type        VARCHAR(50),
    registered_address   VARCHAR(255),
    city                 VARCHAR(255),
    country              VARCHAR(255),
    tax_id_number        VARCHAR(255),
    website              VARCHAR(255),
    owner_full_name      VARCHAR(255),
    owner_id_number      VARCHAR(255),
    owner_id_type        VARCHAR(50),
    status               VARCHAR(50),
    rejection_reason     VARCHAR(255),
    more_info_request    VARCHAR(255),
    created_at           TIMESTAMP,
    submitted_at         TIMESTAMP,
    reviewed_at          TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyb_documents (
    id                   UUID PRIMARY KEY,
    merchant_id          UUID NOT NULL,
    type                 VARCHAR(50) NOT NULL,
    file_name            VARCHAR(255),
    cloudinary_url       TEXT NOT NULL,
    cloudinary_public_id VARCHAR(255),
    file_size_bytes      BIGINT,
    mime_type            VARCHAR(255),
    uploaded_at          TIMESTAMP
);

-- ─────────────────────── Merchants ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchants (
    id                      UUID PRIMARY KEY,
    user_id                 UUID NOT NULL UNIQUE,
    business_name           VARCHAR(255) NOT NULL,
    business_handle         VARCHAR(255) UNIQUE,
    business_email          VARCHAR(255),
    business_phone          VARCHAR(255),
    business_description    VARCHAR(255),
    logo_url                TEXT,
    category                VARCHAR(50),
    status                  VARCHAR(50),
    rejection_reason        VARCHAR(255),
    more_info_request       VARCHAR(255),
    balance                 NUMERIC(15, 2) NOT NULL,
    currency                VARCHAR(255),
    total_volume            NUMERIC(15, 2),
    fee_rate_bps            INTEGER,
    brand_color             VARCHAR(255),
    checkout_tagline        VARCHAR(255),
    support_email           VARCHAR(255),
    tax_enabled             BOOLEAN,
    tax_rate                NUMERIC(5, 2),
    tax_label               VARCHAR(255),
    auto_payout_enabled     BOOLEAN,
    auto_payout_schedule    VARCHAR(50),
    auto_payout_min_balance NUMERIC(15, 2),
    auto_payout_day         INTEGER,
    created_at              TIMESTAMP,
    updated_at              TIMESTAMP,
    activated_at            TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_api_keys (
    id                  UUID PRIMARY KEY,
    merchant_id         UUID NOT NULL,
    label               VARCHAR(255),
    key_prefix          VARCHAR(255) NOT NULL,
    key_hash            VARCHAR(255) NOT NULL UNIQUE,
    environment         VARCHAR(50),
    key_type            VARCHAR(50),
    scopes              VARCHAR(255),
    ip_whitelist        VARCHAR(255),
    expires_at          TIMESTAMP,
    old_key_hash        VARCHAR(255),
    old_key_expires_at  TIMESTAMP,
    last_used_ip        VARCHAR(255),
    last_used_user_agent VARCHAR(255),
    is_active           BOOLEAN,
    last_used_at        TIMESTAMP,
    created_at          TIMESTAMP,
    revoked_at          TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_payouts (
    id             UUID PRIMARY KEY,
    merchant_id    UUID NOT NULL,
    amount         NUMERIC(15, 2) NOT NULL,
    currency       VARCHAR(255),
    status         VARCHAR(50),
    note           VARCHAR(255),
    requested_at   TIMESTAMP,
    completed_at   TIMESTAMP,
    failed_at      TIMESTAMP,
    failure_reason VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS merchant_plans (
    id          UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    amount      NUMERIC(15, 2) NOT NULL,
    currency    VARCHAR(255),
    interval    VARCHAR(50) NOT NULL,
    is_active   BOOLEAN,
    created_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_subscriptions (
    id               UUID PRIMARY KEY,
    plan_id          UUID NOT NULL,
    merchant_id      UUID NOT NULL,
    customer_id      UUID,
    customer_name    VARCHAR(255),
    customer_email   VARCHAR(255),
    status           VARCHAR(50),
    next_billing_at  TIMESTAMP,
    created_at       TIMESTAMP,
    cancelled_at     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_team_members (
    id          UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    email       VARCHAR(255) NOT NULL,
    user_id     UUID,
    role        VARCHAR(50),
    status      VARCHAR(50),
    invite_token VARCHAR(255) UNIQUE,
    invited_at  TIMESTAMP,
    joined_at   TIMESTAMP,
    CONSTRAINT uq_merchant_team_member UNIQUE (merchant_id, email)
);

CREATE TABLE IF NOT EXISTS merchant_notification_preferences (
    id                      UUID PRIMARY KEY,
    merchant_id             UUID NOT NULL UNIQUE,
    email_payment_received  BOOLEAN,
    email_dispute_opened    BOOLEAN,
    email_payout_completed  BOOLEAN,
    email_payout_failed     BOOLEAN,
    email_invoice_paid      BOOLEAN,
    email_weekly_summary    BOOLEAN,
    email_api_key_created   BOOLEAN,
    email_low_balance       BOOLEAN,
    low_balance_threshold   NUMERIC(15, 2),
    updated_at              TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_audit_logs (
    id          UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    action      VARCHAR(255) NOT NULL,
    actor_email VARCHAR(255),
    details     TEXT,
    timestamp   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_api_logs (
    id            UUID PRIMARY KEY,
    merchant_id   UUID NOT NULL,
    api_key_id    UUID,
    method        VARCHAR(255) NOT NULL,
    path          VARCHAR(255) NOT NULL,
    status_code   INTEGER,
    ip_address    VARCHAR(255),
    user_agent    VARCHAR(255),
    error_message TEXT,
    created_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_settlements (
    id                UUID PRIMARY KEY,
    merchant_id       UUID NOT NULL,
    payout_id         UUID,
    gross_amount      NUMERIC(15, 2) NOT NULL,
    fee_total         NUMERIC(15, 2) NOT NULL,
    net_amount        NUMERIC(15, 2) NOT NULL,
    transaction_count INTEGER NOT NULL,
    period_start      TIMESTAMP,
    period_end        TIMESTAMP,
    status            VARCHAR(50),
    created_at        TIMESTAMP,
    settled_at        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_settlement_items (
    id                   UUID PRIMARY KEY,
    settlement_id        UUID NOT NULL,
    checkout_session_id  UUID NOT NULL,
    amount               NUMERIC(15, 2) NOT NULL,
    fee                  NUMERIC(15, 2) NOT NULL,
    net                  NUMERIC(15, 2) NOT NULL,
    transaction_date     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_invoices (
    id                  UUID PRIMARY KEY,
    merchant_id         UUID NOT NULL,
    reference_id        VARCHAR(30) NOT NULL UNIQUE,
    customer_name       VARCHAR(255) NOT NULL,
    customer_email      VARCHAR(255),
    amount              NUMERIC(15, 2) NOT NULL,
    currency            VARCHAR(255),
    description         TEXT,
    due_date            DATE,
    status              VARCHAR(50),
    checkout_session_id UUID,
    created_at          TIMESTAMP,
    sent_at             TIMESTAMP,
    paid_at             TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_discount_codes (
    id            UUID PRIMARY KEY,
    merchant_id   UUID NOT NULL,
    code          VARCHAR(255) NOT NULL,
    discount_type VARCHAR(50) NOT NULL,
    value         NUMERIC(10, 2) NOT NULL,
    max_uses      INTEGER,
    used_count    INTEGER,
    expires_at    TIMESTAMP,
    active        BOOLEAN,
    created_at    TIMESTAMP,
    CONSTRAINT uq_merchant_discount_code UNIQUE (merchant_id, code)
);

-- ─────────────────────── Checkout ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id              UUID PRIMARY KEY,
    merchant_id     UUID NOT NULL,
    amount          NUMERIC(15, 2) NOT NULL,
    currency        VARCHAR(255),
    description     VARCHAR(500),
    metadata        TEXT,
    success_url     VARCHAR(255),
    cancel_url      VARCHAR(255),
    status          VARCHAR(50),
    customer_id     UUID,
    idempotency_key VARCHAR(255) UNIQUE,
    transaction_id  UUID,
    platform_fee    NUMERIC(15, 2),
    net_amount      NUMERIC(15, 2),
    tax_amount      NUMERIC(15, 2),
    tax_label       VARCHAR(255),
    created_at      TIMESTAMP,
    expires_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    cancelled_at    TIMESTAMP,
    refunded_at     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id             UUID PRIMARY KEY,
    merchant_id    UUID NOT NULL,
    url            VARCHAR(255) NOT NULL,
    signing_secret VARCHAR(255) NOT NULL,
    is_active      BOOLEAN,
    events         VARCHAR(255),
    created_at     TIMESTAMP,
    updated_at     TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id                  UUID PRIMARY KEY,
    endpoint_id         UUID NOT NULL,
    checkout_session_id UUID NOT NULL,
    event_type          VARCHAR(255) NOT NULL,
    payload             TEXT NOT NULL,
    status              VARCHAR(50),
    attempt_count       INTEGER,
    response_status_code INTEGER,
    response_body       TEXT,
    next_retry_at       TIMESTAMP,
    created_at          TIMESTAMP,
    last_attempt_at     TIMESTAMP
);

-- ─────────────────────── Chat & Calls ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chats (
    id                       UUID PRIMARY KEY,
    participant_one_id       UUID NOT NULL,
    participant_two_id       UUID NOT NULL,
    last_message_at          TIMESTAMP,
    disappearing_messages_ttl INTEGER,
    is_muted_by_one          BOOLEAN,
    is_muted_by_two          BOOLEAN,
    is_archived_by_one       BOOLEAN,
    is_archived_by_two       BOOLEAN,
    is_support               BOOLEAN,
    status                   VARCHAR(50),
    resolved_at              TIMESTAMP,
    resolved_by_name         VARCHAR(255),
    category                 VARCHAR(255),
    priority                 VARCHAR(50),
    created_at               TIMESTAMP,
    bot_active               BOOLEAN,
    active_agent_id          UUID,
    handed_over_at           TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id                       UUID PRIMARY KEY,
    chat_id                  UUID NOT NULL,
    sender_id                UUID NOT NULL,
    client_id                VARCHAR(128),
    ciphertext               TEXT,
    content                  TEXT,
    ephemeral_key            TEXT,
    pre_key_id               VARCHAR(255),
    sender_identity_public_key TEXT,
    type                     VARCHAR(50),
    status                   VARCHAR(50),
    sent_at                  TIMESTAMP,
    delivered_at             TIMESTAMP,
    read_at                  TIMESTAMP,
    is_deleted               BOOLEAN,
    media_key                VARCHAR(255),
    payment_request_id       UUID,
    view_once                BOOLEAN,
    viewed_at                TIMESTAMP,
    edited_at                TIMESTAMP,
    expires_at               TIMESTAMP,
    is_bot                   BOOLEAN,
    is_admin_reply           BOOLEAN
);

CREATE TABLE IF NOT EXISTS call_sessions (
    id                  UUID PRIMARY KEY,
    caller_id           UUID NOT NULL,
    callee_id           UUID NOT NULL,
    type                VARCHAR(50),
    status              VARCHAR(50),
    initiated_at        TIMESTAMP,
    answered_at         TIMESTAMP,
    ended_at            TIMESTAMP,
    duration_seconds    INTEGER,
    upgrade_requested   BOOLEAN,
    upgrade_requested_by UUID
);

-- ─────────────────────── Social ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
    id              UUID PRIMARY KEY,
    owner_user_id   UUID NOT NULL,
    contact_user_id UUID,
    display_name    VARCHAR(255),
    phone_number    VARCHAR(255),
    email           VARCHAR(255),
    is_aza_user     BOOLEAN,
    is_favorite     BOOLEAN,
    created_at      TIMESTAMP,
    CONSTRAINT uq_contact_owner_phone UNIQUE (owner_user_id, phone_number)
);

CREATE TABLE IF NOT EXISTS contact_requests (
    id               UUID PRIMARY KEY,
    sender_user_id   UUID NOT NULL,
    receiver_user_id UUID NOT NULL,
    status           VARCHAR(50),
    created_at       TIMESTAMP,
    CONSTRAINT uq_contact_request UNIQUE (sender_user_id, receiver_user_id)
);

CREATE TABLE IF NOT EXISTS blocked_users (
    id              UUID PRIMARY KEY,
    blocker_id      UUID NOT NULL,
    blocked_user_id UUID NOT NULL,
    created_at      TIMESTAMP,
    CONSTRAINT uq_blocked_user UNIQUE (blocker_id, blocked_user_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_target  ON blocked_users (blocked_user_id);

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       VARCHAR(255) NOT NULL,
    data       TEXT,
    image_url  VARCHAR(255),
    is_read    BOOLEAN,
    created_at TIMESTAMP
);

-- ─────────────────────── Compliance & Risk ───────────────────────────────────

CREATE TABLE IF NOT EXISTS flagged_transactions (
    id             UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    user_id        UUID NOT NULL,
    amount         NUMERIC(15, 2) NOT NULL,
    currency       VARCHAR(10) NOT NULL,
    flag_reason    TEXT NOT NULL,
    risk_score     INTEGER,
    status         VARCHAR(50),
    flagged_at     TIMESTAMP,
    reviewed_at    TIMESTAMP,
    reviewed_by    UUID,
    notes          TEXT
);

CREATE TABLE IF NOT EXISTS risk_alerts (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL,
    alert_type     VARCHAR(50) NOT NULL,
    severity       VARCHAR(50) NOT NULL,
    description    TEXT NOT NULL,
    transaction_id UUID,
    risk_score     INTEGER,
    status         VARCHAR(50),
    notes          TEXT,
    resolved_by    UUID,
    resolved_at    TIMESTAMP,
    triggered_at   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disputes (
    id             UUID PRIMARY KEY,
    reference_id   VARCHAR(20) NOT NULL UNIQUE,
    transaction_id UUID NOT NULL,
    user_id        UUID NOT NULL,
    amount         NUMERIC(15, 2) NOT NULL,
    currency       VARCHAR(10) NOT NULL,
    category       VARCHAR(50) NOT NULL,
    description    TEXT NOT NULL,
    evidence       TEXT,
    status         VARCHAR(50),
    resolution     TEXT,
    resolved_by    UUID,
    created_at     TIMESTAMP,
    resolved_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id                UUID PRIMARY KEY,
    admin_id          UUID,
    admin_email       VARCHAR(255),
    admin_name        VARCHAR(255),
    action            VARCHAR(255) NOT NULL,
    target_user_id    UUID,
    target_user_email VARCHAR(255),
    details           TEXT,
    timestamp         TIMESTAMP
);

CREATE TABLE IF NOT EXISTS limit_increase_requests (
    id                                    UUID PRIMARY KEY,
    user_id                               UUID NOT NULL,
    current_daily_limit_ghs               NUMERIC(15, 2) NOT NULL,
    current_single_transaction_limit_ghs  NUMERIC(15, 2) NOT NULL,
    requested_daily_limit_ghs             NUMERIC(15, 2) NOT NULL,
    requested_single_transaction_limit_ghs NUMERIC(15, 2) NOT NULL,
    reason                                TEXT,
    status                                VARCHAR(50) NOT NULL,
    admin_notes                           TEXT,
    reviewed_by                           UUID,
    reviewed_at                           TIMESTAMP,
    created_at                            TIMESTAMP
);

-- ─────────────────────── Support ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_notes (
    id          UUID PRIMARY KEY,
    chat_id     UUID NOT NULL,
    author_id   UUID NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canned_responses (
    id          UUID PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    category    VARCHAR(50) NOT NULL,
    usage_count INTEGER,
    created_by  UUID,
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mini_app_reports (
    id                   UUID PRIMARY KEY,
    app_id               VARCHAR(100) NOT NULL,
    reported_by_user_id  UUID NOT NULL,
    reported_by_handle   VARCHAR(100),
    reason               VARCHAR(50) NOT NULL,
    details              TEXT,
    status               VARCHAR(50),
    resolved_by          UUID,
    resolved_at          TIMESTAMP,
    resolution           TEXT,
    created_at           TIMESTAMP
);

-- ─────────────────────── Finance / Analytics ─────────────────────────────────

CREATE TABLE IF NOT EXISTS budgets (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL,
    category      VARCHAR(50) NOT NULL,
    budget_amount NUMERIC(15, 2) NOT NULL,
    period        VARCHAR(50),
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    CONSTRAINT uq_budget_user_category UNIQUE (user_id, category)
);

CREATE TABLE IF NOT EXISTS generated_statements (
    id                   UUID PRIMARY KEY,
    verify_code          VARCHAR(64) NOT NULL UNIQUE,
    user_id              UUID NOT NULL,
    account_holder_name  VARCHAR(255) NOT NULL,
    account_number       VARCHAR(255) NOT NULL,
    period_start         TIMESTAMP NOT NULL,
    period_end           TIMESTAMP NOT NULL,
    transaction_count    INTEGER NOT NULL,
    opening_balance      NUMERIC(15, 2) NOT NULL,
    total_credits        NUMERIC(15, 2) NOT NULL,
    total_debits         NUMERIC(15, 2) NOT NULL,
    closing_balance      NUMERIC(15, 2) NOT NULL,
    generated_at         TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stmt_verify_code ON generated_statements (verify_code);

-- ─────────────────────── Platform config ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS fee_rules (
    id               UUID PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    transaction_type VARCHAR(50) NOT NULL,
    fee_type         VARCHAR(50) NOT NULL,
    amount           NUMERIC(10, 4) NOT NULL,
    min_fee          NUMERIC(15, 2),
    max_fee          NUMERIC(15, 2),
    tier_min_amount  NUMERIC(15, 2),
    tier_max_amount  NUMERIC(15, 2),
    active           BOOLEAN,
    effective_from   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
    id                UUID PRIMARY KEY,
    email             VARCHAR(320) NOT NULL,
    ip_address        VARCHAR(45),
    created_at        TIMESTAMP,
    confirmation_sent BOOLEAN,
    invite_code       VARCHAR(255) UNIQUE,
    invited_at        TIMESTAMP,
    CONSTRAINT uq_waitlist_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS uploaded_files (
    sha256          VARCHAR(64) PRIMARY KEY,
    url             VARCHAR(1024) NOT NULL,
    reference_count INTEGER,
    created_at      TIMESTAMP
);
