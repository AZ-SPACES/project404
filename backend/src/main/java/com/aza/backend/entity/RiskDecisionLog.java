package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Training-data pipeline for a future learned fraud model. Every MEDIUM/HIGH
 * scored transaction gets a row with its features at scoring time; when
 * COMPLIANCE releases or rejects a held transfer, that human decision becomes
 * the label. Once enough labeled rows accumulate, this table is the dataset a
 * supervised model trains on.
 */
@Entity
@Table(name = "risk_decision_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskDecisionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID transactionId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    private Double anomalyScore;

    @Column(length = 10)
    private String riskLevel;

    /** Which heuristic factors fired, as produced by the scorer. */
    @Column(length = 500)
    private String reasons;

    @Column(nullable = false)
    private boolean held;

    /** The human label: how COMPLIANCE decided a held transfer. Null until decided. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Outcome outcome;

    private LocalDateTime decidedAt;

    /** Claude's second opinion, when requested. */
    @Column(length = 20)
    private String aiVerdict;

    @Column(length = 2000)
    private String aiReasoning;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Outcome { RELEASED, REJECTED }
}
