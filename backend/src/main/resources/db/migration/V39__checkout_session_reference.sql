-- Merchant-supplied reference on a checkout session (e.g. the merchant's own order or
-- tenant/seller id). Lets a platform merchant filter and reconcile sessions per tenant
-- without scanning the metadata JSON. Existing rows have no reference (NULL).
ALTER TABLE checkout_sessions
    ADD COLUMN IF NOT EXISTS reference VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant_reference
    ON checkout_sessions (merchant_id, reference);
