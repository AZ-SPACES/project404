package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One person to be paid when a hold is released. Resolved and hard-validated at
 * session creation (before the payer is ever charged) and re-validated at release.
 * There is deliberately NO fallback-to-platform here: if a recipient is unpayable
 * at release, the hold stays HELD — the platform never keeps money a worker earned.
 */
@Entity
@Table(name = "hold_recipients")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class HoldRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID holdId;

    @Column(nullable = false)
    private UUID userId;

    /** The identifier the integrator supplied (phone/email/username), kept for their reconciliation. */
    @Column(nullable = false, length = 255)
    private String identifier;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal releasedAmount = BigDecimal.ZERO;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(length = 500)
    private String failureReason;

    private UUID transactionId;

    public enum Status { PENDING, RELEASED, RELEASE_FAILED, REFUNDED }
}
