package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID senderId;

    @Column(nullable = false)
    private UUID recipientId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionType type = TransactionType.TRANSFER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;

    @Builder.Default
    private Boolean isRequest = false;

    @Column(unique = true)
    private String idempotencyKey;

    private LocalDateTime expiresAt;

    @CreationTimestamp
    private LocalDateTime initiatedAt;

    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    // For money requests
    private LocalDateTime requestedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime declinedAt;

    public enum TransactionType {
        TRANSFER, REQUEST
    }

    public enum TransactionStatus {
        PENDING, COMPLETED, FAILED, CANCELLED, DECLINED, REVERSED
    }
}
