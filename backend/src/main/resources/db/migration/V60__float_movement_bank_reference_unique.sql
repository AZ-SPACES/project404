-- Mint is the only place e-money is created, and nothing stopped the same bank deposit
-- being minted twice: bank_reference carried no constraint and the service did no
-- duplicate check. Two mints citing one deposit put issued e-money above the safeguarded
-- balance -- the exact invariant this table's own header comment claims to protect.
--
-- Maker-checker does not cover it. Two approvals raised for the same deposit are two
-- legitimate approvals, each passing every check the approver can see.
--
-- Unique per (type, bank_reference): one deposit mints once, one wire-out burns once. The
-- pair is the key rather than the reference alone because a mint and a later burn may
-- legitimately cite the same bank transaction when a deposit is returned.
--
-- Partial, so rows predating the requirement (bank_reference NULL) are untouched and a
-- null reference stays permitted at the database level. The service now requires one.

-- If duplicates already exist, this migration stops the deploy on purpose. A duplicate
-- here is e-money issued against a deposit that was only banked once, so it is a
-- safeguarding breach to be reconciled by finance -- not something to silently
-- de-duplicate. The message names the offending references so that work can start.
DO $$
DECLARE
    dupes TEXT;
BEGIN
    SELECT string_agg(DISTINCT type || ':' || bank_reference, ', ')
      INTO dupes
      FROM (
          SELECT type, bank_reference
            FROM float_movements
           WHERE bank_reference IS NOT NULL
           GROUP BY type, bank_reference
          HAVING COUNT(*) > 1
      ) d;

    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION
            'Duplicate float movements share a bank reference: %. Each is e-money minted or burned twice against one bank transaction. Reconcile these with finance before deploying; do not delete rows to clear this.', dupes;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS float_movements_type_bank_reference_key
    ON float_movements (type, bank_reference)
    WHERE bank_reference IS NOT NULL;
