package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A direct disbursement from a platform's merchant balance to an individual seller's
 * Aza wallet — the "collect then pay sellers" half of Aza Connect. Created via the
 * API-key authed {@code POST /api/v1/merchant/connect/transfers} endpoint.
 */
@Entity
@Table(name = "connect_transfers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ConnectTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    /** Resolved seller user id — null when the transfer failed to resolve a recipient. */
    private UUID recipientUserId;

    /** The email/username the platform supplied to identify the seller. */
    @Column(nullable = false)
    private String recipientIdentifier;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    private String currency = "GHS";

    @Column(length = 500)
    private String note;

    /** Platform's own reference (e.g. seller-payout id or order group). */
    private String reference;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(length = 500)
    private String failureReason;

    /** Underlying wallet transaction — null for test-mode (simulated) transfers. */
    private UUID transactionId;

    @Column(name = "test_mode", nullable = false)
    @Builder.Default
    private Boolean testMode = false;

    private String idempotencyKey;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime processedAt;

    public enum Status {
        /** Simulated with an aza_test_ key — no funds moved. */
        SIMULATED,
        PENDING,
        COMPLETED,
        FAILED
    }
}
