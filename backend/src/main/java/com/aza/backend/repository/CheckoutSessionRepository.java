package com.aza.backend.repository;

import com.aza.backend.entity.CheckoutSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CheckoutSessionRepository extends JpaRepository<CheckoutSession, UUID> {

    List<CheckoutSession> findByStatusAndCompletedAtBetween(CheckoutSession.SessionStatus status, LocalDateTime start, LocalDateTime end);

    List<CheckoutSession> findByStatusAndRefundedAtBetween(CheckoutSession.SessionStatus status, LocalDateTime start, LocalDateTime end);

    Page<CheckoutSession> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);

    Optional<CheckoutSession> findByIdempotencyKey(String idempotencyKey);

    @Query("SELECT s FROM CheckoutSession s WHERE s.status = 'PENDING' AND s.expiresAt < :now")
    List<CheckoutSession> findExpiredSessions(@Param("now") LocalDateTime now);

    @Query("SELECT COALESCE(SUM(s.netAmount), 0) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.completedAt >= :from")
    java.math.BigDecimal sumNetAmountSince(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.completedAt >= :from")
    long countCompletedSince(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.createdAt >= :from")
    long countTotalSince(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query(value = "SELECT CAST(s.completed_at AS DATE) AS day, SUM(s.net_amount) AS revenue, COUNT(*) AS cnt " +
                   "FROM checkout_sessions s " +
                   "WHERE s.merchant_id = :merchantId AND s.status = 'COMPLETED' AND s.completed_at >= :from " +
                   "GROUP BY CAST(s.completed_at AS DATE) ORDER BY day", nativeQuery = true)
    List<Object[]> getDailyRevenueSince(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    Optional<CheckoutSession> findByIdAndMerchantId(UUID id, UUID merchantId);

    @Query("SELECT DISTINCT s.customerId FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.customerId IS NOT NULL")
    List<UUID> findDistinctCustomerIdsByMerchantId(@Param("merchantId") UUID merchantId);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.customerId = :customerId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    long countByMerchantIdAndCustomerId(@Param("merchantId") UUID merchantId, @Param("customerId") UUID customerId);

    @Query("SELECT COALESCE(SUM(s.amount), 0) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.customerId = :customerId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    java.math.BigDecimal sumAmountByMerchantIdAndCustomerId(@Param("merchantId") UUID merchantId, @Param("customerId") UUID customerId);

    @Query("SELECT MIN(s.completedAt) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.customerId = :customerId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    java.time.LocalDateTime findFirstPaymentAt(@Param("merchantId") UUID merchantId, @Param("customerId") UUID customerId);

    @Query("SELECT MAX(s.completedAt) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.customerId = :customerId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    java.time.LocalDateTime findLastPaymentAt(@Param("merchantId") UUID merchantId, @Param("customerId") UUID customerId);

    @Query("SELECT s.transactionId FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.transactionId IS NOT NULL")
    List<UUID> findTransactionIdsByMerchantId(@Param("merchantId") UUID merchantId);

    @Query("SELECT s FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.completedAt > :after ORDER BY s.completedAt ASC")
    List<CheckoutSession> findCompletedSessionsAfter(@Param("merchantId") UUID merchantId, @Param("after") java.time.LocalDateTime after);

    @Query("SELECT s FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED ORDER BY s.completedAt ASC")
    List<CheckoutSession> findAllCompletedSessions(@Param("merchantId") UUID merchantId);
}
