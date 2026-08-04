package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "checkout_sessions", uniqueConstraints =
        @UniqueConstraint(name = "checkout_sessions_merchant_idem", columnNames = {"merchant_id", "idempotency_key"}))
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

    // Merchant-supplied reference (e.g. their own order/tenant id). Indexed so a
    // platform merchant can filter and reconcile sessions per tenant without scanning metadata.
    @Column(length = 255)
    private String reference;

    private String successUrl;
    private String cancelUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SessionStatus status = SessionStatus.PENDING;

    /**
     * AUTOMATIC (default) settles to the merchant at confirmation — today's behaviour.
     * MANUAL debits the payer into a {@link PaymentHold} instead, settled later when the
     * integrator calls release or refund. Column is {@code release_mode}; the API field
     * is {@code release}, which is a reserved word in enough SQL dialects to avoid.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "release_mode", nullable = false, length = 16)
    @Builder.Default
    private ReleaseMode releaseMode = ReleaseMode.AUTOMATIC;

    /** MANUAL sessions only: ceiling on how long Aza holds the money before it returns to the payer. */
    private Integer maxHoldDays;

    private UUID customerId;

    // Unique per (merchant_id, idempotency_key) — see the @Table constraint. Global uniqueness
    // was a cross-tenant hazard: one merchant's key could collide with (and via the old unscoped
    // lookup, expose) another merchant's session.
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

    public enum ReleaseMode { AUTOMATIC, MANUAL }
}
