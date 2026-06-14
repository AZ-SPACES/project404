package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Running tally of qualifying value a user has moved this month for a given
 * transaction type. The free-monthly fee tier (e.g. first GHS 1,000/month of P2P
 * is free) is exhausted once {@code usedAmount} crosses the rule's
 * {@code freeMonthlyThreshold}. One row per (user, transactionType, usageMonth).
 */
@Entity
@Table(name = "monthly_fee_usage",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_monthly_fee_usage",
                columnNames = {"userId", "transactionType", "usageMonth"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MonthlyFeeUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 50)
    private String transactionType;

    /** Calendar month in 'YYYY-MM' form (Africa/Accra). */
    @Column(nullable = false, length = 7)
    private String usageMonth;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal usedAmount = BigDecimal.ZERO;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
