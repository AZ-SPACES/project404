package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One seller's share of a checkout payment. Recipients and amounts are validated and
 * resolved when the session is created; the seller's wallet is credited when the buyer
 * confirms payment. If a seller has become unpayable by then, the split falls back to
 * the platform ({@link Status#FALLBACK_TO_PLATFORM}) so the buyer's payment still succeeds.
 */
@Entity
@Table(name = "checkout_session_splits")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CheckoutSessionSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID sessionId;

    /** Resolved seller user id (set at session creation). */
    private UUID recipientUserId;

    @Column(nullable = false)
    private String recipientIdentifier;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(length = 500)
    private String failureReason;

    private UUID transactionId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime processedAt;

    public enum Status {
        PENDING,
        CREDITED,
        FALLBACK_TO_PLATFORM,
        /** Clawed back from the seller during a refund of the parent session. */
        REVERSED
    }
}
