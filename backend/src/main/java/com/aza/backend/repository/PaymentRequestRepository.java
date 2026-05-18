package com.aza.backend.repository;

import com.aza.backend.entity.PaymentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface PaymentRequestRepository extends JpaRepository<PaymentRequest, UUID> {

    List<PaymentRequest> findAllByChatIdOrderByCreatedAtDesc(UUID chatId);

    List<PaymentRequest> findAllByPayerIdAndStatus(UUID payerId, PaymentRequest.PaymentRequestStatus status);

    List<PaymentRequest> findAllByRequesterIdAndStatus(UUID requesterId, PaymentRequest.PaymentRequestStatus status);

    /** Total I paid out in this chat (I was the payer, request was fulfilled). */
    @Query("SELECT COALESCE(SUM(pr.amount), 0) FROM PaymentRequest pr " +
           "WHERE pr.chatId = :chatId AND pr.payerId = :userId AND pr.status = 'PAID'")
    BigDecimal sumPaidByUser(@Param("chatId") UUID chatId, @Param("userId") UUID userId);

    /** Total I received in this chat (I was the requester, request was fulfilled). */
    @Query("SELECT COALESCE(SUM(pr.amount), 0) FROM PaymentRequest pr " +
           "WHERE pr.chatId = :chatId AND pr.requesterId = :userId AND pr.status = 'PAID'")
    BigDecimal sumReceivedByUser(@Param("chatId") UUID chatId, @Param("userId") UUID userId);

    @Query("SELECT COUNT(pr) FROM PaymentRequest pr " +
           "WHERE pr.chatId = :chatId AND pr.status = 'PENDING'")
    long countPendingByChatId(@Param("chatId") UUID chatId);

    /** Find PENDING requests whose expiry has passed. */
    List<PaymentRequest> findByStatusAndExpiresAtBefore(
            PaymentRequest.PaymentRequestStatus status, LocalDateTime cutoff);
}
