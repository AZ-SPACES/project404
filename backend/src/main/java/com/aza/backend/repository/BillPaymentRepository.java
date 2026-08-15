package com.aza.backend.repository;

import com.aza.backend.entity.BillPayment;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BillPaymentRepository extends JpaRepository<BillPayment, UUID> {

    Optional<BillPayment> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

    Page<BillPayment> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /**
     * Settling a payment reads its state and then writes the outcome, and the sweep can
     * be asking about the same one at the same moment the provider's answer arrives.
     * Refunding a payment twice would credit the wallet twice.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM BillPayment p WHERE p.id = :id")
    Optional<BillPayment> findByIdForUpdate(@Param("id") UUID id);

    /** Payments whose outcome is still unknown and old enough to be worth chasing. */
    @Query("SELECT p FROM BillPayment p WHERE p.status = com.aza.backend.entity.BillPayment.Status.PENDING "
            + "AND p.createdAt <= :olderThan ORDER BY p.createdAt ASC")
    List<BillPayment> findStuckPending(@Param("olderThan") LocalDateTime olderThan);

    /**
     * Money debited for bills whose outcome is unknown: it has left a wallet and reached
     * nobody Aza can name. The safeguarding snapshot counts it for the same reason it
     * counts held payments and unopened gifts.
     */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM BillPayment p "
            + "WHERE p.status = com.aza.backend.entity.BillPayment.Status.PENDING")
    BigDecimal sumPendingBillFloat();
}
