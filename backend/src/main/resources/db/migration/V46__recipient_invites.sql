-- Phase 3 of HELD_SETTLEMENT_PLAN.md: let an integrator get a recipient onto Aza.
--
-- Every settlement mode except paying the integrator's own balance requires the recipient
-- to already have an Aza account, and until now there was no supported way to create one
-- from inside an integrator's app — SIGN_IN_WITH_AZA covers authenticating people who
-- already exist. That, not the hold mechanics, is what blocks adoption: a jobs marketplace
-- cannot onboard a plumber who has never heard of Aza.
--
-- An invite is a claim that a merchant wants to pay this identifier. It carries no money
-- and grants nothing; it exists so the merchant can be told when the person becomes payable.

CREATE TABLE IF NOT EXISTS recipient_invites (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id       UUID NOT NULL REFERENCES merchants(id),
    -- Normalized at write time (PhoneNumberUtil), so "0241234567" and "+233241234567"
    -- are the same invite and fulfilment matches whatever shape the user signs up with.
    identifier        VARCHAR(255) NOT NULL,
    display_name      VARCHAR(255),
    -- Merchant's own reference for the person, echoed back on fulfilment so they can
    -- reconcile without storing Aza's invite id.
    reference         VARCHAR(255),
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    invited_user_id   UUID REFERENCES users(id),
    sms_sent          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    fulfilled_at      TIMESTAMP,
    -- One live invite per merchant per person: re-inviting is idempotent rather than a
    -- second SMS to someone who already got one.
    CONSTRAINT recipient_invites_merchant_identifier UNIQUE (merchant_id, identifier)
);

-- Fulfilment looks invites up by identifier at signup, so this is the hot path.
CREATE INDEX IF NOT EXISTS idx_recipient_invites_identifier
    ON recipient_invites (identifier)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_recipient_invites_merchant
    ON recipient_invites (merchant_id, created_at DESC);
