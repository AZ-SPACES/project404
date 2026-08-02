package com.aza.backend.repository;

import com.aza.backend.entity.PaymentHold;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
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

    /** Live money still in holds — the safeguarding heldFloat term. Test holds excluded. */
    @Query("SELECT COALESCE(SUM(h.amount - h.releasedAmount - h.refundedAmount), 0) FROM PaymentHold h "
            + "WHERE h.status IN (com.aza.backend.entity.PaymentHold.HoldStatus.HELD, "
            + "com.aza.backend.entity.PaymentHold.HoldStatus.FROZEN) AND h.testMode = false")
    BigDecimal sumActiveHeldFloat();
}
