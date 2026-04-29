package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "payment_requests",
    indexes = {
        @Index(name = "idx_pr_chat",      columnList = "chat_id"),
        @Index(name = "idx_pr_requester", columnList = "requester_id"),
        @Index(name = "idx_pr_payer",     columnList = "payer_id")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(name = "chat_id", nullable = false)
    private UUID chatId;

    /** The ChatMessage that represents this request in the thread. */
    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "payer_id", nullable = false)
    private UUID payerId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(length = 3)
    @Builder.Default
    private String currency = "GHS";

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PaymentRequestStatus status = PaymentRequestStatus.PENDING;

    /** Set when the request is approved and the transfer completes. */
    private UUID transactionId;

    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime declinedAt;
    private LocalDateTime cancelledAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum PaymentRequestStatus {
        PENDING, PAID, DECLINED, EXPIRED, CANCELLED
    }
}
