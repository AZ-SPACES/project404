-- Phase 2 of HELD_SETTLEMENT_PLAN.md: expiry enforcement and the compliance freeze.
--
-- frozen_at records when Aza suspended a hold for compliance. A review must not
-- consume the payer's hold window, so unfreezing extends expires_at by however long
-- the hold was frozen — otherwise a long investigation would silently push a hold
-- past its expiry and auto-refund a payer mid-review.

ALTER TABLE payment_holds
  ADD COLUMN frozen_at TIMESTAMP;

-- Drives the hourly expiry sweep: warn at T-7 and T-1, auto-refund at expires_at.
-- FROZEN holds are excluded by the status predicate, which is how the clock stops.
CREATE INDEX IF NOT EXISTS idx_payment_holds_expiry_sweep
    ON payment_holds (expires_at)
    WHERE status = 'HELD';

-- The hold-ledger invariant raises a new break reason, and recon_breaks.reason carries a
-- CHECK from V25_5 that predates it. Without this the invariant would throw on insert the
-- first night it detects drift — i.e. it would fail exactly when it finally had something
-- to report, and take the nightly back-office job down with it.
ALTER TABLE recon_breaks DROP CONSTRAINT IF EXISTS recon_breaks_reason_check;
ALTER TABLE recon_breaks ADD CONSTRAINT recon_breaks_reason_check
    CHECK (reason IN ('NO_MATCH', 'AMOUNT_MISMATCH', 'HOLD_LEDGER_DRIFT'));
