package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One person's share of an {@link ExpenseSplit}.
 *
 * The organiser gets a row too. They owe nothing — they already paid the bill — so their
 * row is born {@link Status#PAID} with no payment request behind it. Keeping them in the
 * table is what makes the arithmetic legible: a four-way split shows four shares, not
 * three debts and an unexplained remainder.
 */
@Entity
@Table(name = "expense_split_participants",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_expense_split_participants_split_user",
                columnNames = {"splitId", "userId"}),
        indexes = {
                @Index(name = "idx_expense_split_participants_split", columnList = "splitId"),
                @Index(name = "idx_expense_split_participants_user", columnList = "userId"),
        })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ExpenseSplitParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID splitId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amountOwed;

    /** True for the person who fronted the bill. They are owed, never chased. */
    @Column(nullable = false)
    @Builder.Default
    private boolean organiser = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    /** The money request this person pays their share through. Null for the organiser. */
    private UUID requestTransactionId;

    /** Set when this share was rolled into a settlement with the organiser. */
    private UUID settlementId;

    private LocalDateTime settledAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Status {
        /** Asked, not yet answered. */
        PENDING,
        /** Paid their share. */
        PAID,
        /** Said no. The organiser can re-ask or forgive it. */
        DECLINED,
        /** The organiser forgave this share. It counts as settled. */
        WAIVED,
        /** The split was cancelled before this share was paid. */
        CANCELLED,
        /**
         * Consolidated into a settlement with the organiser — not forgiven, not paid.
         * It becomes {@link #PAID} when that settlement is.
         */
        NETTED
    }

    /** True when this share no longer needs chasing. */
    public boolean isClosed() {
        // NETTED is deliberately absent. A share rolled into a settlement is consolidated,
        // not settled — the money has not moved yet — so its split stays open until the
        // settlement is paid and the share becomes PAID with it.
        return status == Status.PAID || status == Status.WAIVED || status == Status.CANCELLED;
    }
}
