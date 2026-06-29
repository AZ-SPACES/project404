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

    @Query("SELECT s.merchantId, COUNT(s), SUM(CASE WHEN s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED THEN 1 ELSE 0 END), MAX(s.completedAt) FROM CheckoutSession s GROUP BY s.merchantId")
    List<Object[]> merchantCheckoutSummary();

    // ── Merchant analytics ────────────────────────────────────────────────────

    @Query("SELECT COALESCE(SUM(s.amount), 0) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    java.math.BigDecimal sumAllTimeRevenue(@Param("merchantId") UUID merchantId);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.completedAt >= :from")
    long countCompletedFrom(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.createdAt >= :from")
    long countTotalFrom(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query("SELECT COALESCE(AVG(s.amount), 0) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED")
    java.math.BigDecimal avgOrderValue(@Param("merchantId") UUID merchantId);

    @Query("SELECT COALESCE(SUM(s.amount), 0) FROM CheckoutSession s WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED AND s.completedAt >= :from AND s.completedAt < :to")
    java.math.BigDecimal sumRevenueBetween(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query(value = "SELECT CAST(s.completed_at AS DATE) AS day, SUM(s.amount) AS revenue, COUNT(*) AS cnt " +
                   "FROM checkout_sessions s " +
                   "WHERE s.merchant_id = :merchantId AND s.status = 'COMPLETED' AND s.completed_at >= :from " +
                   "GROUP BY CAST(s.completed_at AS DATE) ORDER BY day", nativeQuery = true)
    List<Object[]> getDailyRevenueByAmount(@Param("merchantId") UUID merchantId, @Param("from") LocalDateTime from);

    @Query("SELECT s.customerId, COALESCE(SUM(s.amount), 0), COUNT(s) FROM CheckoutSession s " +
           "WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED " +
           "AND s.customerId IS NOT NULL " +
           "GROUP BY s.customerId ORDER BY COALESCE(SUM(s.amount), 0) DESC")
    List<Object[]> topCustomers(@Param("merchantId") UUID merchantId, Pageable pageable);

    // ── Filtered / search sessions ────────────────────────────────────────────

    // Each nullable optional filter is CAST in its "IS NULL" check so the bind is sent with an
    // explicit type. A standalone "? IS NULL" gives PostgreSQL no type context: it then either
    // infers bytea (→ "function lower(bytea) does not exist" on :q) or fails outright (→ "could
    // not determine data type of parameter" on the temporal :from/:to). Casting pins the type.
    @Query("SELECT s FROM CheckoutSession s WHERE s.merchantId = :merchantId " +
           "AND (:status IS NULL OR s.status = :status) " +
           "AND (CAST(:from AS timestamp) IS NULL OR s.createdAt >= :from) " +
           "AND (CAST(:to AS timestamp) IS NULL OR s.createdAt <= :to) " +
           "AND (CAST(:testMode AS boolean) IS NULL OR s.testMode = :testMode) " +
           "AND (CAST(:q AS string) IS NULL OR LOWER(s.description) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))) " +
           "ORDER BY s.createdAt DESC")
    Page<CheckoutSession> searchSessions(
            @Param("merchantId") UUID merchantId,
            @Param("status") CheckoutSession.SessionStatus status,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("testMode") Boolean testMode,
            @Param("q") String q,
            Pageable pageable);

    // ── Customer transaction history ──────────────────────────────────────────

    Page<CheckoutSession> findAllByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
            UUID merchantId, UUID customerId, Pageable pageable);

    // ── Previous period revenue (for analytics comparison) ────────────────────

    @Query("SELECT COALESCE(SUM(s.amount), 0) FROM CheckoutSession s " +
           "WHERE s.merchantId = :merchantId AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED " +
           "AND s.completedAt >= :from AND s.completedAt < :to")
    java.math.BigDecimal sumRevenuePeriod(
            @Param("merchantId") UUID merchantId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId " +
           "AND s.status = com.aza.backend.entity.CheckoutSession.SessionStatus.COMPLETED " +
           "AND s.completedAt >= :from AND s.completedAt < :to")
    long countCompletedBetween(
            @Param("merchantId") UUID merchantId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT COUNT(s) FROM CheckoutSession s WHERE s.merchantId = :merchantId " +
           "AND s.createdAt >= :from AND s.createdAt < :to")
    long countTotalBetween(
            @Param("merchantId") UUID merchantId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
