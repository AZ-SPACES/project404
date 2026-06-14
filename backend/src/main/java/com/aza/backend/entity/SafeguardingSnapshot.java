package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Daily safeguarding check: customer + merchant float held on the platform
 * versus the balance of the safeguarded bank account that is supposed to back
 * it 1:1 (BoG e-money requirement). A negative variance is a breach.
 */
@Entity
@Table(name = "safeguarding_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SafeguardingSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal customerFloat;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal merchantFloat;

    /** Float held by active agents — a subset of customerFloat, surfaced for visibility. */
    @Column(nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal agentFloat = BigDecimal.ZERO;

    /** Balance of the safeguarding bank account — entered by FINANCE until a bank API exists. */
    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal safeguardingBalance;

    /** safeguardingBalance − (customerFloat + merchantFloat); negative = under-safeguarded. */
    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal variance;

    @Column(nullable = false)
    private boolean breach;

    /** Null when taken by the daily scheduler reusing the last entered bank balance. */
    private UUID recordedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
