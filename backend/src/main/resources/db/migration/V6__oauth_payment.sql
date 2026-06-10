-- Link OAuth clients to merchant accounts for "Pay with AZA" integration
ALTER TABLE oauth_clients
    ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_clients_merchant ON oauth_clients(merchant_id);
