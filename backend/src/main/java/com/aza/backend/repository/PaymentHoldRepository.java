package com.aza.backend.repository;

import com.aza.backend.entity.PaymentHold;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentHoldRepository extends JpaRepository<PaymentHold, UUID> {

    Optional<PaymentHold> findBySessionId(UUID sessionId);

    /**
     * Every hold mutation locks the hold row FIRST, before any wallet or merchant
     * lock — this serialises release vs refund vs (Phase 2) expiry on the same hold.
     * Without it, a release racing an auto-refund can pay a recipient AND refund
     * the payer.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM PaymentHold h WHERE h.sessionId = :sessionId")
    Optional<PaymentHold> findBySessionIdForUpdate(@Param("sessionId") UUID sessionId);

    /**
     * The same lock, reached by hold id rather than session id — for the mutations that
     * start from a hold (freeze, unfreeze, expiry, admin refund). Row locks are re-entrant
     * within a transaction, so a path that locks here and then calls into one that locks
     * by session id takes the same row twice harmlessly.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM PaymentHold h WHERE h.id = :id")
    Optional<PaymentHold> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Holds whose window has run out. FROZEN holds are excluded by the status predicate —
     * that is how a compliance review stops the expiry clock.
     */
    @Query("SELECT h FROM PaymentHold h WHERE h.status = com.aza.backend.entity.PaymentHold.HoldStatus.HELD "
            + "AND h.expiresAt <= :now ORDER BY h.expiresAt ASC")
    List<PaymentHold> findExpired(@Param("now") LocalDateTime now);

    /** Holds expiring inside a window, for the T-7 / T-1 warnings. */
    @Query("SELECT h FROM PaymentHold h WHERE h.status = com.aza.backend.entity.PaymentHold.HoldStatus.HELD "
            + "AND h.expiresAt > :from AND h.expiresAt <= :to")
    List<PaymentHold> findExpiringBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Admin: every hold, newest first, optionally filtered by status. */
    @Query("SELECT h FROM PaymentHold h WHERE (:status IS NULL OR h.status = :status) ORDER BY h.heldAt DESC")
    Page<PaymentHold> findForAdmin(@Param("status") PaymentHold.HoldStatus status, Pageable pageable);

    /**
     * Holds that settled recently — the population the nightly ledger invariant checks.
     * Bounded deliberately: an unbounded scan grows with every hold ever settled and would
     * quietly become the slowest thing in the back-office window. Drift is written at
     * settlement time, so a recent window catches it while it is still actionable.
     */
    @Query("SELECT h FROM PaymentHold h WHERE (h.releasedAmount > 0 OR h.refundedAmount > 0) "
            + "AND h.heldAt >= :since")
    List<PaymentHold> findSettledSince(@Param("since") LocalDateTime since);

    /** Holds under compliance freeze since before {@code cutoff} — money parked with no exit. */
    @Query("SELECT h FROM PaymentHold h WHERE h.status = com.aza.backend.entity.PaymentHold.HoldStatus.FROZEN "
            + "AND h.frozenAt <= :cutoff")
    List<PaymentHold> findLongFrozen(@Param("cutoff") LocalDateTime cutoff);

    long countByStatus(PaymentHold.HoldStatus status);

    /** Live money still in holds — the safeguarding heldFloat term. Test holds excluded. */
    @Query("SELECT COALESCE(SUM(h.amount - h.releasedAmount - h.refundedAmount), 0) FROM PaymentHold h "
            + "WHERE h.status IN (com.aza.backend.entity.PaymentHold.HoldStatus.HELD, "
            + "com.aza.backend.entity.PaymentHold.HoldStatus.FROZEN) AND h.testMode = false")
    BigDecimal sumActiveHeldFloat();
}
