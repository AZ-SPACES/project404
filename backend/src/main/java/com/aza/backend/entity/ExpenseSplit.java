package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A bill one person paid and several people owe a share of.
 *
 * The organiser has already settled with the restaurant, the landlord, or whoever — this
 * records who owes them what, and chases it. No money is escrowed and none moves when a
 * split is created: each share is an ordinary {@link PaymentRequest} the participant
 * approves in their own thread, so paying a share is the same act, with the same
 * passcode and the same limits, as paying any other request.
 *
 * That is why a split has no wallet consequences of its own and never appears in the
 * safeguarding snapshot. It is a ledger of intent sitting on top of transfers that
 * either happen or don't.
 */
@Entity
@Table(name = "expense_splits", indexes = {
        @Index(name = "idx_expense_splits_creator", columnList = "creatorId"),
        @Index(name = "idx_expense_splits_status", columnList = "status"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ExpenseSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    /** Whoever fronted the bill and is owed the shares. */
    @Column(nullable = false)
    private UUID creatorId;

    /**
     * Replaying a create returns the split it already made. Without this a retry on a
     * flaky connection asks everyone for their share twice.
     */
    @Column(nullable = false, length = 100)
    private String idempotencyKey;

    /** The whole bill, including the organiser's own share. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    /** What the money was for — "Dinner at Santoku", "October rent". */
    @Column(nullable = false, length = 140)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private SplitMode splitMode = SplitMode.EQUAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.OPEN;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime settledAt;
    private LocalDateTime cancelledAt;

    public enum SplitMode {
        EQUAL,
        EXACT
    }

    public enum Status {
        OPEN,
        SETTLED,
        CANCELLED
    }
}
