-- KYC document expiry
ALTER TABLE kyc_records ADD COLUMN IF NOT EXISTS id_expiry_date DATE;

-- Transaction fee tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(15,2);

-- Platform promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    credit_amount_ghs NUMERIC(15,2) NOT NULL,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
    user_id UUID NOT NULL,
    credit_amount_ghs NUMERIC(15,2) NOT NULL,
    redeemed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
