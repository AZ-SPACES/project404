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
}
