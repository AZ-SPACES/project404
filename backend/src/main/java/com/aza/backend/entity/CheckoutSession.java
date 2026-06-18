package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "checkout_sessions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CheckoutSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    private String currency = "GHS";

    @Column(length = 500)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String metadata; // merchant-supplied JSON blob

    private String successUrl;
    private String cancelUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SessionStatus status = SessionStatus.PENDING;

    private UUID customerId;

    @Column(unique = true)
    private String idempotencyKey;

    private UUID transactionId; // underlying wallet-to-wallet transaction (null for test-mode sessions)

    // Sandbox flag — true when created with an aza_test_ key. Test sessions complete
    // without moving funds and never touch balances/settlement/reporting.
    @Column(name = "test_mode", nullable = false)
    @Builder.Default
    private Boolean testMode = false;

    @Column(precision = 15, scale = 2)
    private BigDecimal platformFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal netAmount; // amount - platformFee, credited to merchant

    @Column(precision = 15, scale = 2)
    private BigDecimal taxAmount;

    private String taxLabel;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime expiresAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime refundedAt;

    public enum SessionStatus {
        PENDING, COMPLETED, EXPIRED, CANCELLED, REFUNDED
    }
}
