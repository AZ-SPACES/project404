-- V25.5: Back-office operations tables (maker-checker, recon/safeguarding,
-- screening, complaints, DSAR, audit anchors, risk decision log).
--
-- These were originally created by Hibernate ddl-auto=update (the back-office
-- batch shipped before Flyway owned the schema), so existing databases already
-- have them. This migration backfills them into the Flyway chain so a FRESH
-- database builds an identical schema and Hibernate `validate` passes.
--
-- Versioned 25.5 because V26 (float_movements) references safeguarding_snapshots
-- and must run after it. Every statement is IF NOT EXISTS so replaying this on an
-- already-populated production database (baselined at V1) is a safe no-op. DDL is
-- the canonical Hibernate output for the current entities.

CREATE TABLE IF NOT EXISTS account_closure_requests (
    id           UUID NOT NULL,
    user_id      UUID NOT NULL,
    status       VARCHAR(20) NOT NULL,
    reason       VARCHAR(1000) NOT NULL,
    notes        VARCHAR(255),
    processed_by VARCHAR(255),
    requested_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    processed_at TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT account_closure_requests_pkey PRIMARY KEY (id),
    CONSTRAINT account_closure_requests_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS audit_anchors (
    id           UUID NOT NULL,
    anchor_date  DATE NOT NULL,
    entry_count  BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    prev_hash    VARCHAR(64) NOT NULL,
    created_at   TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT audit_anchors_pkey PRIMARY KEY (id),
    CONSTRAINT audit_anchors_anchor_date_key UNIQUE (anchor_date)
);

CREATE TABLE IF NOT EXISTS complaints (
    id                  UUID NOT NULL,
    user_id             UUID,
    handled_by          UUID,
    channel             VARCHAR(20) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    subject             VARCHAR(255) NOT NULL,
    details             TEXT NOT NULL,
    complainant_name    VARCHAR(255),
    complainant_contact VARCHAR(255),
    resolution          VARCHAR(2000),
    ack_due_at          DATE NOT NULL,
    resolve_due_at      DATE NOT NULL,
    acknowledged_at     TIMESTAMP(6) WITHOUT TIME ZONE,
    resolved_at         TIMESTAMP(6) WITHOUT TIME ZONE,
    created_at          TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT complaints_pkey PRIMARY KEY (id),
    CONSTRAINT complaints_channel_check
        CHECK (channel IN ('APP', 'EMAIL', 'PHONE', 'IN_PERSON', 'SOCIAL_MEDIA')),
    CONSTRAINT complaints_status_check
        CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED'))
);

CREATE TABLE IF NOT EXISTS data_requests (
    id           UUID NOT NULL,
    user_id      UUID NOT NULL,
    handled_by   UUID,
    type         VARCHAR(20) NOT NULL,
    status       VARCHAR(20) NOT NULL,
    notes        VARCHAR(1000),
    due_date     DATE NOT NULL,
    created_at   TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    completed_at TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT data_requests_pkey PRIMARY KEY (id),
    CONSTRAINT data_requests_type_check
        CHECK (type IN ('ACCESS', 'DELETION')),
    CONSTRAINT data_requests_status_check
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS email_templates (
    id           UUID NOT NULL,
    template_key VARCHAR(100) NOT NULL,
    subject      VARCHAR(255) NOT NULL,
    body         TEXT NOT NULL,
    updated_by   VARCHAR(100),
    updated_at   TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT email_templates_pkey PRIMARY KEY (id),
    CONSTRAINT email_templates_template_key_key UNIQUE (template_key)
);

CREATE TABLE IF NOT EXISTS pending_approvals (
    id                 UUID NOT NULL,
    requested_by       UUID NOT NULL,
    requested_by_email VARCHAR(255),
    reviewed_by        UUID,
    reviewed_by_email  VARCHAR(255),
    target_id          UUID NOT NULL,
    action_type        VARCHAR(40) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    summary            VARCHAR(500) NOT NULL,
    review_notes       VARCHAR(1000),
    payload            TEXT,
    requested_at       TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    reviewed_at        TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT pending_approvals_pkey PRIMARY KEY (id),
    CONSTRAINT pending_approvals_action_type_check
        CHECK (action_type IN ('REVERSE_TRANSACTION', 'UPDATE_FEE_RULE', 'UPDATE_USER_LIMITS',
            'GRANT_STAFF_ROLE', 'CHANGE_STAFF_ROLE', 'UPDATE_SYSTEM_SETTINGS', 'UNFREEZE_WALLET',
            'REACTIVATE_USER', 'APPROVE_KYC', 'BROADCAST_NOTIFICATION', 'ENABLE_MINI_APP',
            'APPROVE_AGENT', 'MINT_FLOAT', 'BURN_FLOAT')),
    CONSTRAINT pending_approvals_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'))
);

CREATE TABLE IF NOT EXISTS recon_breaks (
    id                  UUID NOT NULL,
    resolved_by         UUID,
    direction           VARCHAR(10) NOT NULL,
    reason              VARCHAR(20) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    import_label        VARCHAR(255) NOT NULL,
    statement_reference VARCHAR(255) NOT NULL,
    statement_amount    NUMERIC(18, 2) NOT NULL,
    internal_amount     NUMERIC(18, 2),
    resolution_notes    VARCHAR(1000),
    created_at          TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    resolved_at         TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT recon_breaks_pkey PRIMARY KEY (id),
    CONSTRAINT recon_breaks_direction_check
        CHECK (direction IN ('CREDIT', 'DEBIT')),
    CONSTRAINT recon_breaks_reason_check
        CHECK (reason IN ('NO_MATCH', 'AMOUNT_MISMATCH')),
    CONSTRAINT recon_breaks_status_check
        CHECK (status IN ('OPEN', 'RESOLVED'))
);

CREATE TABLE IF NOT EXISTS risk_decision_log (
    id             UUID NOT NULL,
    transaction_id UUID NOT NULL,
    user_id        UUID NOT NULL,
    amount         NUMERIC(18, 2) NOT NULL,
    anomaly_score  DOUBLE PRECISION,
    risk_level     VARCHAR(10),
    held           BOOLEAN NOT NULL,
    outcome        VARCHAR(20),
    reasons        VARCHAR(500),
    ai_verdict     VARCHAR(20),
    ai_reasoning   VARCHAR(2000),
    created_at     TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    decided_at     TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT risk_decision_log_pkey PRIMARY KEY (id),
    CONSTRAINT risk_decision_log_transaction_id_key UNIQUE (transaction_id),
    CONSTRAINT risk_decision_log_outcome_check
        CHECK (outcome IN ('RELEASED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS safeguarding_snapshots (
    id                   UUID NOT NULL,
    recorded_by          UUID,
    customer_float       NUMERIC(18, 2) NOT NULL,
    merchant_float       NUMERIC(18, 2) NOT NULL,
    agent_float          NUMERIC(18, 2) NOT NULL,
    safeguarding_balance NUMERIC(18, 2) NOT NULL,
    variance             NUMERIC(18, 2) NOT NULL,
    breach               BOOLEAN NOT NULL,
    created_at           TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT safeguarding_snapshots_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sanctions_list_entries (
    id              UUID NOT NULL,
    added_by        UUID,
    entry_type      VARCHAR(20) NOT NULL,
    list_name       VARCHAR(50) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    country         VARCHAR(255),
    date_of_birth   DATE,
    notes           VARCHAR(500),
    active          BOOLEAN NOT NULL,
    created_at      TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT sanctions_list_entries_pkey PRIMARY KEY (id),
    CONSTRAINT sanctions_list_entries_entry_type_check
        CHECK (entry_type IN ('SANCTION', 'PEP'))
);

CREATE TABLE IF NOT EXISTS screening_matches (
    id              UUID NOT NULL,
    user_id         UUID NOT NULL,
    list_entry_id   UUID NOT NULL,
    reviewed_by     UUID,
    entry_type      VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    list_name       VARCHAR(50) NOT NULL,
    list_entry_name VARCHAR(255) NOT NULL,
    match_score     INTEGER NOT NULL,
    notes           VARCHAR(1000),
    created_at      TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    reviewed_at     TIMESTAMP(6) WITHOUT TIME ZONE,
    CONSTRAINT screening_matches_pkey PRIMARY KEY (id),
    CONSTRAINT screening_matches_entry_type_check
        CHECK (entry_type IN ('SANCTION', 'PEP')),
    CONSTRAINT screening_matches_status_check
        CHECK (status IN ('PENDING_REVIEW', 'FALSE_POSITIVE', 'CONFIRMED'))
);

CREATE TABLE IF NOT EXISTS user_consents (
    id          UUID NOT NULL,
    user_id     UUID NOT NULL,
    doc_type    VARCHAR(30) NOT NULL,
    version     VARCHAR(50) NOT NULL,
    ip_address  VARCHAR(45),
    accepted_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT user_consents_pkey PRIMARY KEY (id),
    CONSTRAINT user_consents_doc_type_check
        CHECK (doc_type IN ('TERMS', 'PRIVACY'))
);
