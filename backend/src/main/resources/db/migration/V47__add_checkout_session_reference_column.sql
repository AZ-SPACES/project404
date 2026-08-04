-- The CheckoutSession entity has carried a `reference` field (merchant-supplied order/tenant
-- id, used by CheckoutSessionRepository's search and reconcileByReference queries) since before
-- the Flyway migration history was made authoritative. Production's checkout_sessions table
-- predates Flyway (built by ddl-auto=update) and already has the column, so this was never
-- caught there — but any database provisioned from V1 forward (fresh clone, CI, new
-- environment) fails Hibernate schema validation on startup with "missing column [reference]
-- in table [checkout_sessions]" because no migration ever created it.
ALTER TABLE checkout_sessions
    ADD COLUMN IF NOT EXISTS reference VARCHAR(255);

-- Referenced in the entity's own comment as "indexed so a platform merchant can filter and
-- reconcile sessions per tenant without scanning metadata" — matches how
-- CheckoutSessionRepository.search() and reconcileByReference() actually query it.
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant_reference
    ON checkout_sessions (merchant_id, reference);
