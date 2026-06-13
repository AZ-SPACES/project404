-- Referral codes: each user gets a unique invite code on registration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;

-- Referral tracking: one row per successful invite conversion.
CREATE TABLE IF NOT EXISTS referrals (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code             VARCHAR(12)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING | REWARDED | CANCELLED
    reward_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP    NOT NULL DEFAULT now(),
    rewarded_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code     ON referrals(code);
