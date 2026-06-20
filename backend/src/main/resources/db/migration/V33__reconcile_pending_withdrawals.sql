-- V33: Reconcile PENDING user_withdrawals created before the request-time debit fix.
--
-- The old withdrawal flow checked balance but never debited/reserved it, so existing
-- PENDING rows have their funds still sitting in the wallet. The new code treats a
-- PENDING withdrawal as "funds already reserved" (approve = no further debit, reject =
-- refund). Without this backfill, rejecting a legacy PENDING row would REFUND money that
-- was never taken (over-credit), and approving one would pay out without a debit.
--
-- Strategy, applied per row oldest-first so cumulative reservations are correct:
--   * sufficient wallet balance  -> reserve the funds (debit wallet + mirror users.balance),
--                                   matching the new invariant. Row stays PENDING.
--   * insufficient / no wallet    -> the funds can't be reserved (already spent), so the
--                                   request can't be funded: mark REJECTED. No money moves
--                                   (nothing was ever debited), so this is balance-neutral.
--
-- On a fresh database the table is empty and this is a no-op.

DO $$
DECLARE
    w   RECORD;
    bal NUMERIC(18, 2);
BEGIN
    FOR w IN
        SELECT id, user_id, amount
        FROM user_withdrawals
        WHERE status = 'PENDING'
        ORDER BY created_at
    LOOP
        SELECT balance INTO bal FROM wallets WHERE user_id = w.user_id FOR UPDATE;

        IF bal IS NOT NULL AND bal >= w.amount THEN
            -- Reserve the funds to match the new request-time debit invariant.
            UPDATE wallets SET balance = balance - w.amount WHERE user_id = w.user_id;
            UPDATE users SET balance = bal - w.amount WHERE id = w.user_id;
        ELSE
            -- Cannot reserve (no wallet, or funds spent since the request): reject. Nothing
            -- was ever debited under the old flow, so no refund is owed — balance-neutral.
            UPDATE user_withdrawals
            SET status      = 'REJECTED',
                admin_note  = COALESCE(admin_note, '')
                              || ' [auto-reconciled V33: could not reserve funds for a pre-fix pending withdrawal]',
                reviewed_at = now()
            WHERE id = w.id;
        END IF;
    END LOOP;
END $$;
