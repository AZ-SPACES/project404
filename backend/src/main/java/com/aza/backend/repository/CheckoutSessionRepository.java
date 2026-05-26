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
}
