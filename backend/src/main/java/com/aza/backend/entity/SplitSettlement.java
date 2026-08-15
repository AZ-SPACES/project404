package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Several debts between two people collapsed into one.
 *
 * Two friends who split a dinner, a taxi, and then the other way round for lunch end up
 * owing each other three separate amounts. Settling those one at a time is three
 * transfers to say what a single transfer says better, and the direction is often not
 * even the one either of them expected.
 *
 * A settlement takes every outstanding share between the two of them, in both
 * directions, and replaces them with a single request for the difference. The shares it
 * covers are marked {@link ExpenseSplitParticipant.Status#NETTED} — consolidated, not
 * forgiven. They only become paid when this does.
 *
 * Like a share, this moves no money of its own: it is one more ordinary money request,
 * accepted with the same passcode and against the same limits as any other.
 */
@Entity
@Table(name = "split_settlements", indexes = {
        @Index(name = "idx_split_settlements_creditor", columnList = "creditorId"),
        @Index(name = "idx_split_settlements_debtor", columnList = "debtorId"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SplitSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    /** Who ends up being owed once everything is netted off. */
    @Column(nullable = false)
    private UUID creditorId;

    /** Who ends up owing. Which of the two this is falls out of the arithmetic. */
    @Column(nullable = false)
    private UUID debtorId;

    /** The difference — what actually needs to move. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    /** The single request the debtor accepts. Null when the debts cancelled exactly. */
    private UUID requestTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime settledAt;

    public enum Status {
        /** Waiting on the debtor. The shares behind it are still outstanding. */
        PENDING,
        /** Paid. Every share it covered is settled with it. */
        PAID,
        /** Refused or withdrawn; the shares it covered go back to being asked separately. */
        CANCELLED
    }
}
