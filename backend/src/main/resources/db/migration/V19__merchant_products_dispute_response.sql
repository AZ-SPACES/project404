-- Add merchant_response field to disputes
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS merchant_response TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS merchant_responded_at TIMESTAMP;

-- Product catalog for merchants
CREATE TABLE IF NOT EXISTS merchant_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    image_url VARCHAR(1000),
    sku VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant_id ON merchant_products(merchant_id);
